var express = require("express");
var app = express();
var http = require("http").createServer(app);
var io = require('socket.io')(http);
var formidable = require("formidable");
var fs = require("fs");
var mv = require("mv");
var marvel = require('marvel-characters');

app.set("view engine", "ejs");
app.use(express.static('public'))

function getUUID(){
	return Math.random().toString(36).substring(2);
}

var serverId = getUUID();
app.get("/", function(req, res){
	res.render("index", {'_id': serverId});
});

app.get('/marvel', function(req, resp){
	var char = marvel();
	while(Object.keys(clients).includes(char)){
		char = marvel();
	}
	resp.send(char.split(" ").join(''));
	resp.end();
});

app.get("/fileupload", function(req, res){
	res.render("fileupload");
});

var fileUploadPercent = 0;
app.post("/fileupload", function(req, res){
	var form = new formidable.IncomingForm();
	form.parse(req, function(err, fields, files){
		var file = files[Object.keys(files)[0]];
		mv(file.path, 'public\\'+file.name, function(err) {
		  if(err) throw err;
		  fileUploadPercent = 0;
		});
  	});
  	form.on('progress', function(bytesRecieved, bytesExpected){
		var newPercent = ((bytesRecieved/bytesExpected)*100);
		if(newPercent > fileUploadPercent){
			io.emit('progress', newPercent);
		}
		fileUploadPercent = newPercent;
	});
	form.on('file', function(file){
		io.emit("uploaded", fileUploadPercent);
	});
});

clients = {};
client_gc = {};

io.on('connection', function(socket){
	
	socket.on(serverId, function(resp){
		var respSplit = resp.split("~");
		clients[respSplit[1]] = true;
		client_gc[respSplit[1]] = 1;
		if(respSplit[0].length > 0){
			socket.broadcast.emit(serverId, "<span class='chat-title'>"+respSplit[1]+"</span><br>"+respSplit[0]);
		}
	});

	socket.on('is online '+serverId, function(clientId){
		clients[clientId] = true;
		client_gc[clientId] += 1;
	});

	socket.on('typing', function(clientId){
		socket.broadcast.emit('typing', clientId);
	});
});

var checkOnline = setInterval(function(){
	var keys = Object.keys(clients);
	for(var i = 0;i < keys.length;i++){
		clients[keys[i]] = false;
		client_gc[keys[i]] -= 1;
		if(-20 > client_gc[keys[i]]){
			delete clients[keys[i]];
		}else{
			io.emit('is online '+keys[i], true);
		}
	}
}, 250);

clientsOnline = setInterval(function(){
	io.emit('online clients', clients);
}, 900);

http.listen(3000, function(){
	console.log("[3000] server online...");
});