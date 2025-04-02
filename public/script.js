var startFlag= false;;
var stopFlag= false;;
var continueFlag= false;;
var resetFlag= false;
var runFlag = false;
var setMin = 0;
var setSec = 0;
var setMs = 0;
var startTime;
var startDate;
var targetTime;
var nowTime;

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

var socket = io();
var isConnected = false;

// Web Audio API の初期化
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

// 1秒ごとにビープ音を鳴らす
var lastSecond = -1; // 直前の秒を記録

$("#set_font_size").on('input', () => {
  if(isConnected){
    socket.emit("settings", {
      room: roomId,
      settings: "fontsize",
      fontsize: $("#set_font_size").val()
    });
  }else{
    fontSize = $("#set_font_size").val();
    $("#fontsize").text(fontSize);
    $(".countdown").css("font-size", fontSize+"vw");
  }
}); 

window.onload = ()=>{
  var queries = GetUrlQueries();
  if(queries["room"]){
    roomId = queries["room"];
    JoinRoom();
  }
  InitSettings();
  ResetTime();
}

const InitSettings = () => {
  $("#fontsize").text(fontSize);
  $(".countdown").css("font-size", fontSize+"vw");

  $("#set_min").val(setMin);
  $("#set_sec").val(setSec);
  $("#set_ms").val(setMs);

  $("#set_back_col").val(backGroundColor);
  $("body").css("background-color", backGroundColor);
  $("#set_timer_fore_col").val(timerForeColor);
  $(".countdown").css("color", timerForeColor);
  $("#set_timer_back_col").val(timerBackColor);
  $(".countdown").css("background-color", timerBackColor);
  $("#set_enable_sound").prop('checked', isEnableSound);
}

const BackColorChange = () => {
  if(isConnected){
    socket.emit("settings", {
      room: roomId,
      settings: "backGroundColor",
      backGroundColor: $("#set_back_col").val()
    });
  }else{
    backGroundColor = $("#set_back_col").val();
    $("body").css("background-color", backGroundColor);
  }
}

const TimerForeColorChange = () => {
  if(isConnected){
    socket.emit("settings", {
      room: roomId,
      settings: "timerForeColor",
      timerForeColor: $("#set_timer_fore_col").val()
    });
  }else{
    timerForeColor = $("#set_timer_fore_col").val();
    $(".countdown").css("color", timerForeColor);
  }
}

const TimerBackColorChange = () => {
  if(isConnected){
    socket.emit("settings", {
      room: roomId,
      settings: "timerBackColor",
      timerBackColor: $("#set_timer_back_col").val()
    });
  }else{
    timerBackColor = $("#set_timer_back_col").val();
    $(".countdown").css("background-color", timerBackColor);
  }
}

const countdown = ()=>{
  if(nowTime < 0){
    nowTime = 0;
    stopFlag = true;
  }

  if(startFlag){
    if(!runFlag){
        if(!continueFlag){
            //初回
            continueFlag = true;
            startTime = targetTime;
        }
        startDate = new Date();
        runFlag = true;
    }
    startFlag = false;
  }
  
  if(stopFlag){
    startTime = nowTime;
    runFlag = false;
    stopFlag = false;
  }

  if(resetFlag){
    nowTime = targetTime;
    runFlag = false;
    continueFlag = false;
    GetSettingTime();
    ResetTime();
    SetTime(setMin, setSec, setMs);
    resetFlag = false;
  }

  if (runFlag) {
    var nowSubTime = new Date().getTime() - startDate.getTime();
    if (nowSubTime != 0) {
      nowTime = startTime - nowSubTime;
      if (nowTime >= 0) {
        var min = Math.floor(nowTime / 1000 / 60); // 分
        var sec = Math.floor(nowTime / 1000 % 60); // 秒
        var ms = Math.floor((nowTime % 1000) / 10); // ミリ秒

        // 1秒ごとに音を鳴らす
        if (sec !== lastSecond) {
          lastSecond = sec;
          if(isEnableSound) playBeep();
        }

        SetTime(min, sec, ms);
      }
    }
  }
}

setInterval(countdown, 1);

function SetTime(m, s, ms){
  $('.js-countdown-min').text(String(m).padStart(2, '0'));
  $('.js-countdown-sec').text(String(s).padStart(2, '0'));
  $('.js-countdown-ms').text(String(ms).padStart(2, '0'));
}

const ClickResetArea = () => {
  ResetTimer();
}

const ClickToggleArea = () => {
  ToggleTimer();
}

const ClickSettingArea = () => {
  OpenSettings();
}

const ClickApplyButton = () => {
  ResetTimer();
}

const ClickGenerateButton = () => {
  if(!roomId){
    roomId = crypto.randomUUID();
    var query = { "room":roomId };
    SetUrlQueries(query)
    JoinRoom();
  }
}

const ToggleEnableSound = () => {
  isEnableSound = $("#set_enable_sound").prop('checked');
}

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("beep_waveform").addEventListener("change", function () {
    beepWaveform = this.value;
  });

  document.getElementById("beep_frequency").addEventListener("input", function () {
    beepFrequency = this.value;
    document.getElementById("beep_frequency_value").textContent = beepFrequency;
  });

  document.getElementById("beep_duration").addEventListener("input", function () {
    beepDuration = this.value / 1000;
    document.getElementById("beep_duration_value").textContent = beepDuration;
  });

  document.getElementById("beep_feed").addEventListener("input", function () {
    beepDuration = this.value / 1000;
    document.getElementById("beep_feed_value").textContent = beepDuration;
  });
});

const ResetTimer = () => {
  if(isConnected){
    socket.emit("controll", {
      room: roomId,
      controll: "reset",
      setMin: $("#set_min").val(),
      setSec: $("#set_sec").val(),
      setMs: $("#set_ms").val(),
    });
  }else{
    resetFlag = true;
  }
}

const ToggleTimer = () => {
  if(runFlag){
    if(isConnected){
      socket.emit("controll", {
        room: roomId,
        controll: "stop"
      });
    }else{
      stopFlag = true;
    }
  }else{
    if(isConnected){
      socket.emit("controll", {
        room: roomId,
        controll: "start"
      });
    }else{
      nowTime = targetTime;
      if(nowTime > 0){
        startFlag = true;
      }
    }
  }
}

const OpenSettings = () => {
  if(!isOpenSetting){
    $(".hidden_area")[0].style.opacity = 0.2;
    $(".setting_window").css({
      "opacity":"0",
      "display":"none",
    }).show().animate({opacity:1}, 500)
    isOpenSetting = true;
  }else{
    $(".hidden_area")[0].style.opacity = 0;
    $(".setting_window").css({
      "opacity":"1",
      "display":"block",
    }).animate({opacity:0}, 500, () => {$(".setting_window").hide()})
    isOpenSetting = false;
  }
}

const ResetTime = () => {
  targetTime = setMin*60*1000 + setSec*1000 + setMs*10;
  startTime = targetTime;
  SetTime(setMin, setSec, setMs);
}

const GetSettingTime = () => {
  setMin = $("#set_min").val();
  setSec = $("#set_sec").val();
  setMs = $("#set_ms").val();
}

function GetUrlQueries() {
  var queryStr = window.location.search.slice(1);  // 文頭?を除外
  queries = {};

  if (!queryStr) {
    return queries;
  }

  queryStr.split('&').forEach(function(queryStr) {
    var queryArr = queryStr.split('=');
    queries[queryArr[0]] = queryArr[1];
  });
  
  return queries;
}

function SetUrlQueries(dict){
  var url = new URL(location.href);
  for (key in dict){
    url.searchParams.set(key, dict[key]);
  }
  window.history.replaceState(null, null, url);
}

function copyToClipboard() {
  navigator.clipboard.writeText($("#set_room_url_txt").val());
  $("#set_room_url_txt").select();
}

const JoinRoom = () => {
  var url = window.location.href;
  $("#set_room_url_txt").val(url);
  $("#set_room_url_btn").prop("disabled", true);
  socket.emit('join', {
    room: roomId,
    setMin: setMin,
    setSec: setSec,
    setMs: setMs,
    backGroundColor: backGroundColor,
    timerForeColor: timerForeColor,
    timerBackColor: timerBackColor,
    fontSize: fontSize
  });
}

socket.on("hello", function(msg){
  setMin = msg.setMin;
  setSec = msg.setSec;
  setMs = msg.setMs;
  backGroundColor = msg.backGroundColor;
  timerBackColor = msg.timerBackColor;
  timerForeColor = msg.timerForeColor;
  fontSize = msg.fontSize;
  InitSettings();
  isConnected = true;
});

socket.on('controll',function(msg){
  switch(msg.controll){
    case 'start':
        nowTime = targetTime;
        if(nowTime > 0){
          startFlag = true;
        }
      break;
    case 'stop':
      stopFlag = true;
      break;
    case 'reset':
      $("#set_min").val(msg.setMin);
      $("#set_sec").val(msg.setSec);
      $("#set_ms").val(msg.setMs);
      resetFlag = true;
      break;
  }
});

socket.on('settings', function(msg){
  switch(msg.settings){
    case 'fontsize':
      fontSize = msg.fontsize;
      $("#set_font_size").val(fontSize);
      $("#fontsize").text(fontSize);
      $(".countdown").css("font-size", fontSize+"vw");
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
    