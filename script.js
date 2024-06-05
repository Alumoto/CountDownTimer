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

var isOpenSetting = false;
var backGroundColor = "#ffffff";
var timerForeColor = "#ff0000";
var timerBackColor = "#ffffff";
var fontSize = 15;

$("#set_font_size").on('input', () => {
  fontSize = $("#set_font_size").val();
  $("#fontsize").text(fontSize);
  $(".countdown").css("font-size", fontSize+"vw");
});

const GetUrlParam = () => {

}

const SetUrlParam = () => {

}

const onload = ()=>{
  $("#fontsize").text(fontSize);

  $("#set_min").val(setMin);
  $("#set_sec").val(setSec);
  $("#set_ms").val(setMs);

  $("#set_back_col").val(backGroundColor);
  $("#set_timer_fore_col").val(timerForeColor);
  $("#set_timer_back_col").val(timerBackColor);

  ResetTime();
}

const BackColorChange = () => {
  backGroundColor = $("#set_back_col").val();
  $("body").css("background-color", backGroundColor);
}

const TimerForeColorChange = () => {
  timerForeColor = $("#set_timer_fore_col").val();
  $(".countdown").css("color", timerForeColor);
}

const TimerBackColorChange = () => {
  timerBackColor = $("#set_timer_back_col").val();
  $(".countdown").css("background-color", timerBackColor);
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

  if(runFlag){
    var nowSubTime= new Date().getTime() - startDate.getTime();
    if(nowSubTime != 0){
      nowTime = startTime - nowSubTime;
      if(nowTime >= 0) {
    
      var min = Math.floor(nowTime / 1000 / 60); //分
      var sec = Math.floor(nowTime / 1000 % 60); //秒
      var ms = Math.floor((nowTime % 1000) / 10); //ミリ秒

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

window.onload = onload;

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

const ResetTimer = () => {
  resetFlag = true;
}

const ToggleTimer = () => {
  if(runFlag){
    stopFlag = true;
  }else{
    nowTime = targetTime;
    if(nowTime > 0){
      startFlag = true;
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