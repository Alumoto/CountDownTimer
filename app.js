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

var store = [];
var idStore = {};

function getRoomInfo(roomId) {
  return store.find((o) => o.room === roomId);
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

  var totalSetTime = getTotalSetTime(roomInfo);

  if (!roomInfo.isStart) {
    return Math.max(Number(roomInfo.startTime ?? totalSetTime), 0);
  }

  var startAt = Number(roomInfo.startTime || 0);
  if (!startAt) {
    return Math.max(totalSetTime, 0);
  }

  var elapsed = Date.now() - startAt;
  return Math.max(totalSetTime - elapsed, 0);
}

io.on("connection", function (socket) {
  console.log("connected:", socket.id);

  socket.on("join", function (msg) {
    if (!msg || !msg.room) return;

    console.log("join " + socket.id + " room=" + msg.room);

    socket.join(msg.room);
    idStore[socket.id] = msg.room;

    var roomInfo = getRoomInfo(msg.room);

    if (!roomInfo) {
      var initialTotal =
        Number(msg.setMin || 0) * 60 * 1000 +
        Number(msg.setSec || 0) * 1000 +
        Number(msg.setMs || 0) * 10;

      store.push({
        room: msg.room,
        count: 1,
        setMin: Number(msg.setMin || 0),
        setSec: Number(msg.setSec || 0),
        setMs: Number(msg.setMs || 0),
        startTime:
          typeof msg.startTime === "number" ? msg.startTime : initialTotal,
        isStart: Boolean(msg.isStart),
        backGroundColor: msg.backGroundColor || "#000000",
        timerForeColor: msg.timerForeColor || "#ff0000",
        timerBackColor: msg.timerBackColor || "#000000",
        fontSize: Number(msg.fontSize || 15),
      });
      roomInfo = getRoomInfo(msg.room);
    } else {
      store = store.map((p) =>
        p.room === msg.room ? { ...p, count: p.count + 1 } : p
      );
      roomInfo = getRoomInfo(msg.room);
    }

    var remainTime = getRemainTime(roomInfo);

    io.to(msg.room).emit("hello", {
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

    var roomId = idStore[socket.id];
    if (!roomId) return;

    socket.leave(roomId);

    var roomInfo = getRoomInfo(roomId);
    if (roomInfo) {
      var count = roomInfo.count - 1;
      if (count > 0) {
        store = store.map((p) =>
          p.room === roomId ? { ...p, count: count } : p
        );
      } else {
        store = store.filter((f) => f.room !== roomId);
      }
    }

    delete idStore[socket.id];
  });

  socket.on("controll", function (msg) {
    if (!msg || !msg.room) return;

    var roomInfo = getRoomInfo(msg.room);
    if (!roomInfo) return;

    switch (msg.controll) {
      case "start": {
        var startAt = Number(msg.startTime || Date.now());
        store = store.map((p) =>
          p.room === msg.room
            ? {
                ...p,
                isStart: true,
                startTime: startAt,
              }
            : p
        );
        break;
      }

      case "stop": {
        var remainTime =
          typeof msg.startTime === "number"
            ? Number(msg.startTime)
            : getRemainTime(roomInfo);

        store = store.map((p) =>
          p.room === msg.room
            ? {
                ...p,
                isStart: false,
                startTime: Math.max(remainTime, 0),
              }
            : p
        );
        break;
      }

      case "reset": {
        var newSetMin = Number(msg.setMin || 0);
        var newSetSec = Number(msg.setSec || 0);
        var newSetMs = Number(msg.setMs || 0);
        var totalSetTime =
          newSetMin * 60 * 1000 + newSetSec * 1000 + newSetMs * 10;

        store = store.map((p) =>
          p.room === msg.room
            ? {
                ...p,
                setMin: newSetMin,
                setSec: newSetSec,
                setMs: newSetMs,
                isStart: false,
                startTime: totalSetTime,
              }
            : p
        );
        break;
      }
    }

    io.to(msg.room).emit("controll", msg);
  });

  socket.on("settings", function (msg) {
    if (!msg || !msg.room) return;

    switch (msg.settings) {
      case "fontsize":
        store = store.map((p) =>
          p.room === msg.room ? { ...p, fontSize: Number(msg.fontsize) } : p
        );
        break;

      case "backGroundColor":
        store = store.map((p) =>
          p.room === msg.room
            ? { ...p, backGroundColor: msg.backGroundColor }
            : p
        );
        break;

      case "timerForeColor":
        store = store.map((p) =>
          p.room === msg.room
            ? { ...p, timerForeColor: msg.timerForeColor }
            : p
        );
        break;

      case "timerBackColor":
        store = store.map((p) =>
          p.room === msg.room
            ? { ...p, timerBackColor: msg.timerBackColor }
            : p
        );
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