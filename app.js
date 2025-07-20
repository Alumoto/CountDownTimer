var path = require("path");
var express = require('express');
var app = express();
var http = require('http').Server(app);
const io = require('socket.io')(http);
const PORT = process.env.PORT || 7000;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/cdt.html');
});

http.listen(PORT, function(){
  console.log('server listening. Port:' + PORT);
});

var store = [];
var idStore = {};

io.on('connection', function (socket) {
  console.log('connected');
  socket.on('join', function(msg) {
    console.log('join' + socket.id);
    socket.join(msg.room);
    idStore[socket.id] = msg.room;
    var roomInfo = store.find(o => o.room === msg.room);
    if(!roomInfo){
      store.push({
        room: msg.room,
        count: 1,
        setMin: msg.setMin,
        setSec: msg.setSec,
        setMs: msg.setMs,
        startTime: msg.startTime,
        isStart: msg.isStart,
        backGroundColor: msg.backGroundColor,
        timerForeColor: msg.timerForeColor,
        timerBackColor: msg.timerBackColor,
        fontSize: msg.fontSize
      });
      roomInfo = store.find(o => o.room === msg.room);
    }else{
      store = store.map(p => p.room === msg.room ? {...p, count: roomInfo.count + 1} : p);
    }

    var now = Date.now();
    var elapsed = 0;
    if(roomInfo.isStart){
      elapsed = now - roomInfo.startTime;
    }
    var totalSetTime = roomInfo.setMin * 60 * 1000 + roomInfo.setSec * 1000 + roomInfo.setMs * 10;
    var remainTime = Math.max(totalSetTime - elapsed, 0);

    io.to(msg.room).emit('hello', {
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
      remainTime: remainTime 
    });
  });

  socket.on('disconnect', function(msg) {
    console.log(msg);
    if (idStore[socket.id]) {
      var roomId = idStore[socket.id];
      socket.leave(roomId);
      var roomInfo = store.find(o => o.room == roomId);
      var count = roomInfo.count - 1;
      if(count > 0){
        store = store.map(p => p.room == roomId ? {...p, count: roomInfo.count - 1} : p);
      }else{
        store = store.filter(f => f.room != roomId);
      }
      delete idStore[socket.id];
    }
  });

  socket.on('controll', function(msg) {
    switch(msg.controll){
      case "start":
        store = store.map(p => p.room === msg.room ? {...p, isStart: true} : p);
        store = store.map(p => p.room === msg.room ? {...p, startTime: msg.startTime} : p);
        break;
      case "stop":
        store = store.map(p => p.room === msg.room ? {...p, isStart: false} : p);
        store = store.map(p => p.room === msg.room ? {...p, startTime: msg.startTime} : p);
        break;
      case "reset":
        store = store.map(p => p.room === msg.room ? {...p, setMin: msg.setMin} : p);
        store = store.map(p => p.room === msg.room ? {...p, setSec: msg.setSec} : p);
        store = store.map(p => p.room === msg.room ? {...p, setMs: msg.setMs} : p);
        break;
    }
    io.to(msg.room).emit('controll', msg);
  });

  socket.on('settings', function(msg){
    switch(msg.settings){
      case "fontsize":
        store = store.map(p => p.room === msg.room ? {...p, fontSize: msg.fontsize} : p);
        break;
      case "backGroundColor":
        store = store.map(p => p.room === msg.room ? {...p, backGroundColor: msg.backGroundColor} : p);
        break;
      case "timerForeColor":
        store = store.map(p => p.room === msg.room ? {...p, timerForeColor: msg.timerForeColor} : p);
        break;
      case "timerBackColor":
        store = store.map(p => p.room === msg.room ? {...p, timerBackColor: msg.timerBackColor} : p);
        break;
  }
    io.to(msg.room).emit('settings', msg);
  });
});


