var startFlag = false;
var stopFlag = false;
var continueFlag = false;
var resetFlag = false;
var runFlag = false;
var setMin = 0;
var setSec = 0;
var setMs = 0;
var startTime = 0;
var startDate;
var targetTime = 0;
var nowTime = 0;

var isEnableSound = false;
var beepWaveform = "sine";
var beepFrequency = 2000;
var beepDuration = 0.06;
var beepFeed = 0.06;

var isOpenSetting = false;
var backGroundColor = "#000000";
var timerForeColor = "#ff0000";
var timerBackColor = "#000000";
var fontSize = 15;

var roomId;
var directInputBuffer = "000000";

var socket = io();
var isConnected = false;
var heartbeatTimer = null;

var resyncTimer = null;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const playBeep = () => {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = beepWaveform;
  oscillator.frequency.setValueAtTime(beepFrequency, audioContext.currentTime);

  gainNode.gain.setValueAtTime(1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + beepFeed);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + beepDuration);
};

var lastSecond = -1;

function quantizeToDisplayUnit(ms) {
  return Math.max(Math.floor(Number(ms || 0) / 10) * 10, 0);
}

function currentRemainTime() {
  if (runFlag && startDate) {
    const elapsed = Date.now() - startDate.getTime();
    return quantizeToDisplayUnit(startTime - elapsed);
  }
  return quantizeToDisplayUnit(nowTime);
}

function startHeartbeat() {
  stopHeartbeat();

  if (!roomId) return;

  heartbeatTimer = setInterval(() => {
    if (socket.connected && roomId) {
      socket.emit("heartbeat", { room: roomId });
    }
  }, 30000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function syncDirectInputBufferFromCurrentTime() {
  var minStr = String(Number(setMin || 0)).padStart(2, "0");
  var secStr = String(Number(setSec || 0)).padStart(2, "0");
  var msStr = String(Number(setMs || 0)).padStart(2, "0");
  directInputBuffer = (minStr + secStr + msStr).slice(-6);
}

function applyDirectInputBuffer() {
  var min = Number(directInputBuffer.slice(0, 2));
  var sec = Number(directInputBuffer.slice(2, 4));
  var ms = Number(directInputBuffer.slice(4, 6));

  setMin = min;
  setSec = sec;
  setMs = ms;

  $("#set_min").val(setMin);
  $("#set_sec").val(setSec);
  $("#set_ms").val(setMs);

  targetTime = setMin * 60 * 1000 + setSec * 1000 + setMs * 10;
  nowTime = targetTime;
  startTime = targetTime;
  continueFlag = false;
  runFlag = false;
  startFlag = false;
  stopFlag = false;
  resetFlag = false;

  SetTime(setMin, setSec, setMs);
}

function pushDirectInputDigit(digit) {
  directInputBuffer = (directInputBuffer + digit).slice(-6);
  applyDirectInputBuffer();
}

function popDirectInputDigit() {
  directInputBuffer = ("0" + directInputBuffer.slice(0, 5)).slice(-6);
  applyDirectInputBuffer();
}

function canUseDirectInput(e) {
  if (runFlag) return false;
  if (isOpenSetting) return false;

  var tag = (e.target && e.target.tagName) ? e.target.tagName.toUpperCase() : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) {
    return false;
  }

  return true;
}

function resumeRunningTimerFromRemain(remainTime) {
  nowTime = quantizeToDisplayUnit(remainTime);
  startTime = nowTime;
  startDate = new Date();
  continueFlag = true;
  runFlag = nowTime > 0;
  startFlag = false;
  stopFlag = false;
}

$("#set_font_size").on("input", () => {
  if (isConnected) {
    socket.emit("settings", {
      room: roomId,
      settings: "fontsize",
      fontsize: $("#set_font_size").val(),
    });
  } else {
    fontSize = Number($("#set_font_size").val());
    $("#fontsize").text(fontSize);
    $(".countdown").css("font-size", fontSize + "vw");
  }
});

window.onload = () => {
  var queries = GetUrlQueries();

  if (queries["room"]) {
    roomId = queries["room"];
  } else {
    InitSettings();
    ResetTime();
    syncDirectInputBufferFromCurrentTime();
  }
};

const InitSettings = () => {
  $("#fontsize").text(fontSize);
  $(".countdown").css("font-size", fontSize + "vw");

  $("#set_min").val(setMin);
  $("#set_sec").val(setSec);
  $("#set_ms").val(setMs);

  $("#set_back_col").val(backGroundColor);
  $("body").css("background-color", backGroundColor);
  $("#set_timer_fore_col").val(timerForeColor);
  $(".countdown").css("color", timerForeColor);
  $("#set_timer_back_col").val(timerBackColor);
  $(".countdown").css("background-color", timerBackColor);
  $("#set_enable_sound").prop("checked", isEnableSound);
};

const BackColorChange = () => {
  if (isConnected) {
    socket.emit("settings", {
      room: roomId,
      settings: "backGroundColor",
      backGroundColor: $("#set_back_col").val(),
    });
  } else {
    backGroundColor = $("#set_back_col").val();
    $("body").css("background-color", backGroundColor);
  }
};

const TimerForeColorChange = () => {
  if (isConnected) {
    socket.emit("settings", {
      room: roomId,
      settings: "timerForeColor",
      timerForeColor: $("#set_timer_fore_col").val(),
    });
  } else {
    timerForeColor = $("#set_timer_fore_col").val();
    $(".countdown").css("color", timerForeColor);
  }
};

const TimerBackColorChange = () => {
  if (isConnected) {
    socket.emit("settings", {
      room: roomId,
      settings: "timerBackColor",
      timerBackColor: $("#set_timer_back_col").val(),
    });
  } else {
    timerBackColor = $("#set_timer_back_col").val();
    $(".countdown").css("background-color", timerBackColor);
  }
};

const countdown = () => {
  if (nowTime < 0) {
    nowTime = 0;
    stopFlag = true;
  }

  if (startFlag) {
    if (!runFlag) {
      if (!continueFlag) {
        continueFlag = true;
        startTime = targetTime;
      }
      startDate = new Date();
      runFlag = true;
    }
    startFlag = false;
  }

  if (stopFlag) {
    startTime = nowTime;
    runFlag = false;
    stopFlag = false;
  }

  if (resetFlag) {
    GetSettingTime();
    ResetTime();
    nowTime = targetTime;
    runFlag = false;
    continueFlag = false;
    SetTime(setMin, setSec, setMs);
    syncDirectInputBufferFromCurrentTime();
    resetFlag = false;
  }

  if (runFlag) {
    var nowSubTime = new Date().getTime() - startDate.getTime();
    if (nowSubTime !== 0) {
      nowTime = quantizeToDisplayUnit(startTime - nowSubTime);

      if (nowTime <= 0) {
        nowTime = 0;
        runFlag = false;
        continueFlag = true;
        SetTime(0, 0, 0);
        return;
      }

      var min = Math.floor(nowTime / 1000 / 60);
      var sec = Math.floor((nowTime / 1000) % 60);
      var ms = Math.floor((nowTime % 1000) / 10);

      if (sec !== lastSecond) {
        lastSecond = sec;
        if (isEnableSound) playBeep();
      }

      SetTime(min, sec, ms);
    }
  }
};

setInterval(countdown, 1);

function SetTime(m, s, ms) {
  $(".js-countdown-min").text(String(m).padStart(2, "0"));
  $(".js-countdown-sec").text(String(s).padStart(2, "0"));
  $(".js-countdown-ms").text(String(ms).padStart(2, "0"));
}

const ClickResetArea = () => {
  ResetTimer();
};

const ClickToggleArea = () => {
  ToggleTimer();
};

const ClickSettingArea = () => {
  OpenSettings();
};

const ClickApplyButton = () => {
  ResetTimer();
};

const ClickGenerateButton = () => {
  if (!roomId) {
    roomId = crypto.randomUUID();
    var query = { room: roomId };
    SetUrlQueries(query);
  }

  if (socket.connected) {
    JoinRoom();
  }

  const qrArea = document.getElementById("qrcode");
  qrArea.innerHTML = "";
  new QRCode(qrArea, {
    text: window.location.href,
    width: 128,
    height: 128,
  });
};

const ToggleEnableSound = () => {
  isEnableSound = $("#set_enable_sound").prop("checked");
};

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("beep_waveform").addEventListener("change", function () {
    beepWaveform = this.value;
  });

  document.getElementById("beep_frequency").addEventListener("input", function () {
    beepFrequency = Number(this.value);
    document.getElementById("beep_frequency_value").textContent = beepFrequency;
  });

  document.getElementById("beep_duration").addEventListener("input", function () {
    beepDuration = Number(this.value) / 1000;
    document.getElementById("beep_duration_value").textContent = beepDuration;
  });

  document.getElementById("beep_feed").addEventListener("input", function () {
    beepFeed = Number(this.value) / 1000;
    document.getElementById("beep_feed_value").textContent = beepFeed;
  });
});

const ResetTimer = () => {
  if (isConnected) {
    socket.emit("controll", {
      room: roomId,
      controll: "reset",
      setMin: $("#set_min").val(),
      setSec: $("#set_sec").val(),
      setMs: $("#set_ms").val(),
    });
  } else {
    resetFlag = true;
  }
};

const ToggleTimer = () => {
  if (runFlag) {
    if (isConnected) {
      const syncedNow = currentRemainTime();

      nowTime = syncedNow;
      startTime = syncedNow;
      runFlag = false;
      stopFlag = false;
      startFlag = false;
      continueFlag = true;

      SetTime(
        Math.floor(syncedNow / 1000 / 60),
        Math.floor((syncedNow / 1000) % 60),
        Math.floor((syncedNow % 1000) / 10)
      );

      socket.emit("controll", {
        room: roomId,
        controll: "stop",
        startTime: syncedNow
      });
    } else {
      stopFlag = true;
    }
  } else {
    if (isConnected) {
      socket.emit("controll", {
        room: roomId,
        controll: "start",
        startTime: Date.now()
      });
    } else {
      nowTime = targetTime;
      if (nowTime > 0) {
        startFlag = true;
      }
    }
  }
};

const OpenSettings = () => {
  if (!isOpenSetting) {
    $(".hidden_area")[0].style.opacity = 0.2;
    $(".setting_window")
      .css({
        opacity: "0",
        display: "none",
      })
      .show()
      .animate({ opacity: 1 }, 500);
    isOpenSetting = true;
  } else {
    $(".hidden_area")[0].style.opacity = 0;
    $(".setting_window")
      .css({
        opacity: "1",
        display: "block",
      })
      .animate({ opacity: 0 }, 500, () => {
        $(".setting_window").hide();
      });
    isOpenSetting = false;
  }
};

const ResetTime = () => {
  targetTime = Number(setMin) * 60 * 1000 + Number(setSec) * 1000 + Number(setMs) * 10;
  startTime = targetTime;
  nowTime = targetTime;
  SetTime(Number(setMin), Number(setSec), Number(setMs));
};

const GetSettingTime = () => {
  setMin = Number($("#set_min").val());
  setSec = Number($("#set_sec").val());
  setMs = Number($("#set_ms").val());
};

function GetUrlQueries() {
  var queryStr = window.location.search.slice(1);
  var queries = {};

  if (!queryStr) {
    return queries;
  }

  queryStr.split("&").forEach(function(queryStr) {
    var queryArr = queryStr.split("=");
    queries[queryArr[0]] = queryArr[1];
  });

  return queries;
}

function SetUrlQueries(dict) {
  var url = new URL(location.href);
  for (key in dict) {
    url.searchParams.set(key, dict[key]);
  }
  window.history.replaceState(null, null, url);
}

function copyToClipboard() {
  navigator.clipboard.writeText($("#set_room_url_txt").val());
  $("#set_room_url_txt").select();
}

const JoinRoom = () => {
  if (!roomId) return;
  if (!socket.connected) return;

  var url = window.location.href;
  $("#set_room_url_txt").val(url);
  $("#set_room_url_btn").prop("disabled", true);

  socket.emit("join", {
    room: roomId,
    setMin: Number(setMin),
    setSec: Number(setSec),
    setMs: Number(setMs),
    startTime: currentRemainTime(),
    isStart: runFlag,
    backGroundColor: backGroundColor,
    timerForeColor: timerForeColor,
    timerBackColor: timerBackColor,
    fontSize: Number(fontSize)
  });

  startHeartbeat();
};

function startResyncTimer() {
  stopResyncTimer();

  resyncTimer = setInterval(() => {
    if (runFlag && roomId && socket.connected) {
      JoinRoom();
    }
  }, 60000);
}

function stopResyncTimer() {
  if (resyncTimer) {
    clearInterval(resyncTimer);
    resyncTimer = null;
  }
}

socket.on("connect", function () {
  if (roomId) {
    JoinRoom();
  }
  startResyncTimer();
});

socket.on("disconnect", function () {
  isConnected = false;
  stopHeartbeat();
  stopResyncTimer();
});

socket.on("hello", function(msg) {
  setMin = Number(msg.setMin);
  setSec = Number(msg.setSec);
  setMs = Number(msg.setMs);
  backGroundColor = msg.backGroundColor;
  timerBackColor = msg.timerBackColor;
  timerForeColor = msg.timerForeColor;
  fontSize = Number(msg.fontSize);

  InitSettings();
  isConnected = true;

  targetTime = Number(setMin) * 60 * 1000 + Number(setSec) * 1000 + Number(setMs) * 10;
  nowTime = quantizeToDisplayUnit(msg.remainTime || 0);
  startTime = nowTime;

  if (msg.isStart && nowTime > 0) {
    resumeRunningTimerFromRemain(nowTime);
  } else {
    runFlag = false;
    startFlag = false;
    stopFlag = false;
    continueFlag = nowTime !== targetTime;
    startTime = nowTime;

    SetTime(
      Math.floor(nowTime / 1000 / 60),
      Math.floor((nowTime / 1000) % 60),
      Math.floor((nowTime % 1000) / 10)
    );
  }

  syncDirectInputBufferFromCurrentTime();
});

socket.on("controll", function(msg) {
  switch (msg.controll) {
    case "start":
      if (!runFlag && nowTime > 0) {
        startFlag = true;
      }
      break;

    case "stop":
      if (typeof msg.startTime === "number") {
        const syncedNow = quantizeToDisplayUnit(msg.startTime);
        nowTime = syncedNow;
        startTime = syncedNow;

        SetTime(
          Math.floor(syncedNow / 1000 / 60),
          Math.floor((syncedNow / 1000) % 60),
          Math.floor((syncedNow % 1000) / 10)
        );
      }
      stopFlag = true;
      break;

    case "reset":
      $("#set_min").val(msg.setMin);
      $("#set_sec").val(msg.setSec);
      $("#set_ms").val(msg.setMs);
      resetFlag = true;
      break;
  }
});

socket.on("settings", function(msg) {
  switch (msg.settings) {
    case "fontsize":
      fontSize = Number(msg.fontsize);
      $("#set_font_size").val(fontSize);
      $("#fontsize").text(fontSize);
      $(".countdown").css("font-size", fontSize + "vw");
      break;

    case "backGroundColor":
      backGroundColor = msg.backGroundColor;
      $("#set_back_col").val(backGroundColor);
      $("body").css("background-color", backGroundColor);
      break;

    case "timerForeColor":
      timerForeColor = msg.timerForeColor;
      $("#set_timer_fore_col").val(timerForeColor);
      $(".countdown").css("color", timerForeColor);
      break;

    case "timerBackColor":
      timerBackColor = msg.timerBackColor;
      $("#set_timer_back_col").val(timerBackColor);
      $(".countdown").css("background-color", timerBackColor);
      break;
  }
});

socket.on("heartbeat", function (_msg) {
});

document.addEventListener("keydown", (e) => {
  if (canUseDirectInput(e)) {
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      pushDirectInputDigit(e.key);
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      popDirectInputDigit();
      return;
    }

    if (e.key === "Delete") {
      e.preventDefault();
      directInputBuffer = "000000";
      applyDirectInputBuffer();
      return;
    }
  }

  switch (e.code) {
    case "KeyS":
      OpenSettings();
      break;

    case "KeyR":
      ResetTimer();
      break;

    case "Space":
      e.preventDefault();
      ToggleTimer();
      break;
  }
});