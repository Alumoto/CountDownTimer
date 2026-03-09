var path = require("path");
var express = require("express");
var app = express();
var http = require("http").Server(app);
const io = require("socket.io")(http);
const PORT = process.env.PORT || 7000;

app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/cdt.html");
});

http.listen(PORT, function () {
  console.log("server listening. Port:" + PORT);
});

const ROOM_GRACE_MS = 2 * 60 * 1000;

const rooms = new Map();     // roomId -> roomInfo
const socketToRoom = new Map(); // socket.id -> roomId

function createRoomFromJoinMessage(msg) {
  const setMin = Number(msg.setMin || 0);
  const setSec = Number(msg.setSec || 0);
  const setMs = Number(msg.setMs || 0);
  const totalSetTime = setMin * 60 * 1000 + setSec * 1000 + setMs * 10;

  return {
    room: msg.room,
    members: new Set(),
    cleanupTimer: null,

    setMin,
    setSec,
    setMs,

    // isStart === true のときは「開始絶対時刻」
    // isStart === false のときは「残り時間」
    startTime:
      typeof msg.startTime === "number" ? Number(msg.startTime) : totalSetTime,
    isStart: Boolean(msg.isStart),

    backGroundColor: msg.backGroundColor || "#000000",
    timerForeColor: msg.timerForeColor || "#ff0000",
    timerBackColor: msg.timerBackColor || "#000000",
    fontSize: Number(msg.fontSize || 15),
  };
}

function getRoomInfo(roomId) {
  return rooms.get(roomId);
}

function getTotalSetTime(roomInfo) {
  return (
    Number(roomInfo.setMin || 0) * 60 * 1000 +
    Number(roomInfo.setSec || 0) * 1000 +
    Number(roomInfo.setMs || 0) * 10
  );
}

function getRemainTime(roomInfo) {
  if (!roomInfo) return 0;

  const totalSetTime = getTotalSetTime(roomInfo);

  if (!roomInfo.isStart) {
    return Math.max(Number(roomInfo.startTime ?? totalSetTime), 0);
  }

  const startAt = Number(roomInfo.startTime || 0);
  if (!startAt) {
    return Math.max(totalSetTime, 0);
  }

  const elapsed = Date.now() - startAt;
  return Math.max(totalSetTime - elapsed, 0);
}

function clearRoomCleanupTimer(roomInfo) {
  if (roomInfo && roomInfo.cleanupTimer) {
    clearTimeout(roomInfo.cleanupTimer);
    roomInfo.cleanupTimer = null;
  }
}

function scheduleRoomCleanup(roomInfo) {
  clearRoomCleanupTimer(roomInfo);

  roomInfo.cleanupTimer = setTimeout(() => {
    const latest = rooms.get(roomInfo.room);
    if (!latest) return;

    if (latest.members.size === 0) {
      console.log("cleanup room:", latest.room);
      rooms.delete(latest.room);
    }
  }, ROOM_GRACE_MS);
}

function applyJoinStateToRoom(roomInfo, msg) {
  if (!roomInfo || !msg) return;

  // 「誰もいない状態からの復帰」のときだけ、クライアント状態で復元する
  // これにより、瞬断→再接続でタイマー状態を失わない
  if (roomInfo.members.size === 0) {
    roomInfo.setMin = Number(msg.setMin || 0);
    roomInfo.setSec = Number(msg.setSec || 0);
    roomInfo.setMs = Number(msg.setMs || 0);

    roomInfo.startTime =
      typeof msg.startTime === "number"
        ? Number(msg.startTime)
        : getTotalSetTime(roomInfo);

    roomInfo.isStart = Boolean(msg.isStart);

    roomInfo.backGroundColor = msg.backGroundColor || roomInfo.backGroundColor;
    roomInfo.timerForeColor = msg.timerForeColor || roomInfo.timerForeColor;
    roomInfo.timerBackColor = msg.timerBackColor || roomInfo.timerBackColor;
    roomInfo.fontSize = Number(msg.fontSize || roomInfo.fontSize || 15);
  }
}

io.on("connection", function (socket) {
  console.log("connected:", socket.id);

  socket.on("join", function (msg) {
    if (!msg || !msg.room) return;

    console.log("join", socket.id, "room=", msg.room);

    const roomId = msg.room;
    socket.join(roomId);
    socketToRoom.set(socket.id, roomId);

    let roomInfo = getRoomInfo(roomId);

    if (!roomInfo) {
      roomInfo = createRoomFromJoinMessage(msg);
      rooms.set(roomId, roomInfo);
    } else {
      clearRoomCleanupTimer(roomInfo);
      applyJoinStateToRoom(roomInfo, msg);
    }

    roomInfo.members.add(socket.id);

    const remainTime = getRemainTime(roomInfo);

    socket.emit("hello", {
      room: roomInfo.room,
      setMin: roomInfo.setMin,
      setSec: roomInfo.setSec,
      setMs: roomInfo.setMs,
      startTime: roomInfo.startTime,
      isStart: roomInfo.isStart,
      backGroundColor: roomInfo.backGroundColor,
      timerForeColor: roomInfo.timerForeColor,
      timerBackColor: roomInfo.timerBackColor,
      fontSize: roomInfo.fontSize,
      remainTime: remainTime,
    });
  });

  socket.on("disconnect", function (reason) {
    console.log("disconnect:", socket.id, reason);

    const roomId = socketToRoom.get(socket.id);
    if (!roomId) return;

    const roomInfo = getRoomInfo(roomId);
    if (roomInfo) {
      roomInfo.members.delete(socket.id);

      if (roomInfo.members.size === 0) {
        scheduleRoomCleanup(roomInfo);
      }
    }

    socketToRoom.delete(socket.id);
  });

  socket.on("controll", function (msg) {
    if (!msg || !msg.room) return;

    const roomInfo = getRoomInfo(msg.room);
    if (!roomInfo) return;

    switch (msg.controll) {
      case "start": {
        const startAt = Number(msg.startTime || Date.now());
        roomInfo.isStart = true;
        roomInfo.startTime = startAt;
        break;
      }

      case "stop": {
        const remainTime =
          typeof msg.startTime === "number"
            ? Number(msg.startTime)
            : getRemainTime(roomInfo);

        roomInfo.isStart = false;
        roomInfo.startTime = Math.max(remainTime, 0);
        break;
      }

      case "reset": {
        const newSetMin = Number(msg.setMin || 0);
        const newSetSec = Number(msg.setSec || 0);
        const newSetMs = Number(msg.setMs || 0);
        const totalSetTime =
          newSetMin * 60 * 1000 + newSetSec * 1000 + newSetMs * 10;

        roomInfo.setMin = newSetMin;
        roomInfo.setSec = newSetSec;
        roomInfo.setMs = newSetMs;
        roomInfo.isStart = false;
        roomInfo.startTime = totalSetTime;
        break;
      }
    }

    io.to(msg.room).emit("controll", msg);
  });

  socket.on("settings", function (msg) {
    if (!msg || !msg.room) return;

    const roomInfo = getRoomInfo(msg.room);
    if (!roomInfo) return;

    switch (msg.settings) {
      case "fontsize":
        roomInfo.fontSize = Number(msg.fontsize);
        break;

      case "backGroundColor":
        roomInfo.backGroundColor = msg.backGroundColor;
        break;

      case "timerForeColor":
        roomInfo.timerForeColor = msg.timerForeColor;
        break;

      case "timerBackColor":
        roomInfo.timerBackColor = msg.timerBackColor;
        break;
    }

    io.to(msg.room).emit("settings", msg);
  });

  socket.on("heartbeat", function (msg) {
    if (!msg || !msg.room) return;
    socket.emit("heartbeat", {
      room: msg.room,
      serverTime: Date.now(),
    });
  });
});