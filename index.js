var app = require('express')();
var http = require('http').createServer(app);
var chokidar = require('chokidar');
const fs = require('fs');
var thumb = require('node-thumbnail').thumb;
var path = require("path");
var io = require('socket.io')(http);

const imgfolder = "public/img/"
const thumbfolder = "public/thumbnails/"

var watcher_img = chokidar.watch(imgfolder, {ignored: /^\./, persistent: true});
var watcher_thumb = chokidar.watch(thumbfolder, {ignored: /^\./, persistent: true});


function generate_thumb(filepath){
	thumb({
		source: filepath,
		destination: thumbfolder,
		concurrency: 4
	}, function(files, err, stdout, stderr) {
		console.log('All done!');
	});
}

function delete_thumb(filepath){
	var base = path.basename(filepath).replace(/\.[^/.]+$/, "")
	var ext = path.extname(path.basename(filepath))
	fs.unlinkSync(thumbfolder + base + "_thumb" + ext);
}

function update_client(filepath){}

function update_img(action, filepath){
	if(action == "add" || action == "change"){
		generate_thumb(filepath)
	} else {
		delete_thumb(filepath)
	}
}

function update_thumb(action, filepath){
	update_client(filepath)
}

function thumb_list(socket){
	fs.readdir(thumbfolder, function(err, files) {
		var filelist = []
		files.forEach(function(file) {
			filelist.push(file)
		})
		socket.emit('thumb_list', filelist);
	})	
}

function clear_thumbs(){
	fs.readdir(thumbfolder, function(err, files) {
		files.forEach(function(file) {
			fs.unlinkSync(thumbfolder + file);
		})
	})
}


app.get('/', function(req, res){
	res.sendFile(__dirname + '/public/index.html');
});

app.get('/main.css', function(req, res){
	res.sendFile(__dirname + '/public/main.css');
});

app.get('/thumbnails/*', function(req, res){
	res.sendFile(__dirname + "/public/" + req.path.replace("%20", " "));
});

io.on('connection', function(socket){
	io.on('connection', function(socket){
		thumb_list(socket)

		socket.on('add_image', function(){
			console.log('new image');
		});

		socket.on('delete_image', function(){
			console.log('new image');
		});
	});
});

http.listen(3000, function(){
	clear_thumbs()

	watcher_img
		.on('add', function(ipath) {update_img("add", ipath)})
		.on('change', function(ipath) {update_img("change", ipath)})
		.on('unlink', function(ipath) {update_img("delete", ipath)})

	watcher_thumb
		.on('add', function(ipath) {update_thumb("add", ipath)})
		.on('change', function(ipath) {update_thumb("change", ipath)})
		.on('unlink', function(ipath) {update_thumb("delete", ipath)})

});