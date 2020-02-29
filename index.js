var app = require("express")();
var http = require("http").createServer(app);
var chokidar = require("chokidar");
const fs = require("fs");
var path = require("path");
var io = require('socket.io')(http);
var multer  = require('multer')
var upload = multer({ dest: 'cache/' })
const https = require('https');
const imageThumbnail = require('image-thumbnail');
const getSize = require('get-folder-size');

var imgfolder = "public/img/"
const thumbfolder = "public/thumbnails/"

var watcher_img = chokidar.watch(imgfolder, {ignored: /^\./, persistent: true});
var watcher_thumb = chokidar.watch(thumbfolder, {ignored: /^\./, persistent: true});

var global_socket;

function getimgsize(){
	var size = 0
	getSize(imgfolder, (err, size) => {
		if (err) { throw err; }
		size = (size / 1024 / 1024).toFixed(2)
		if(global_socket){global_socket.emit("imgsize", size)}
	});

}

function generate_thumb(filepath, fileorurl){
	if(fileorurl != "file"){
		var thumbpath = thumbfolder + filepath.split("/").pop()
	}else{
		var thumbpath = thumbfolder + path.basename(filepath)
	}

	if(fileorurl != "file"){
		if(!filepath.startsWith("http")){
			filepath = "https://" + filepath
		}
		filepath = {uri: filepath.toString()}
	}

	imageThumbnail(filepath, {width: 400})
	    .then(thumbnail => {
	    	fs.writeFile(thumbpath, thumbnail, function(err) {
			    if(err) {
			        return console.log(err);
			    }
			    console.log("generated", thumbpath)
			}); 
	    })
	    .catch(err => console.error(err));

}

function delete_thumb(filepath){
	var base = path.basename(filepath).replace(/\.[^/.]+$/, "")
	var ext = path.extname(path.basename(filepath))
	fs.unlinkSync(thumbfolder + base + "_thumb" + ext);
}

function update_client(filepath){
	if(global_socket){
		var base = path.basename(filepath)
		global_socket.emit("update_client", base);
	}
}

function remove_client(filepath){
	if(global_socket){
		var base = path.basename(filepath)
		global_socket.emit('remove_client', base);
	}
}

function update_img(action, filepath){
	if(action == "add"){
		generate_thumb(filepath, "file")
	}else if (action == "delete"){
		delete_thumb(filepath)
		remove_client(filepath)
	}
	getimgsize()
}

var filesglobal = []

function read_files(dir){
	return fs.readdirSync(dir, function(err, files){
		files = files.map(function (fileName) {
		    return {
		      name: fileName,
		      time: fs.statSync(dir + '/' + fileName).mtime.getTime()
		    }
		}).sort(function (a, b) {
		    return a.time - b.time; 
		}).map(function (v) {
		    return v.name;
		});

		return files
	}); 
}

function thumb_list(socket){
	var files = read_files(thumbfolder)
	socket.emit("thumb_list", files);
}

function clear_thumbs(){
	fs.readdir(thumbfolder, function(err, files) {
		files.forEach(function(file) {
			fs.unlinkSync(thumbfolder + file);
		})
	})
}


app.get("/", function(req, res){
	res.sendFile(__dirname + "/public/index.html");
});

app.get("/css/main.css", function(req, res){
	res.sendFile(__dirname + "/public/css/main.css");
});

app.get("/js/upload.js", function(req, res){
	res.sendFile(__dirname + "/public/js/upload.js");
});

app.get("/thumbnails/*", function(req, res){
	res.sendFile(__dirname + "/public/" + req.path.replace("%20", " "));
});

var cpUpload = upload.fields([{ name: 'img', maxCount: 100 }])
app.post('/add_image', cpUpload, function (req, res, next) {
	var original = req.files.img[0].originalname
	var filename = req.files.img[0].filename

	fs.rename("cache/" + filename, imgfolder + original, function (err) {
		if (err) throw err
		res.redirect("back");
	})
})

function endsWithAny(suffixes, string) {
    return suffixes.some(function (suffix) {
        return string.endsWith(suffix);
    });
}

io.on("connection", function(socket){
	thumb_list(socket)
	global_socket = socket;
	getimgsize();

	socket.on("download_url", function(s){
		if(endsWithAny([".jpg", ".jpeg", ".png"], s)){
			generate_thumb(s, "url")
		}
	});
});


if (require.main === module) {
	var args = process.argv.slice(2);

	if(!args[1]){args[1] = "./public/img/"}
	if(args[1].endsWith("/")){args[1] += "/"}
	imgfolder = args[1];

	http.listen(args[0], function(){
		clear_thumbs()

		watcher_img
			.on("add", function(ipath) {update_img("add", ipath)})
			.on("change", function(ipath) {update_img("change", ipath)})
			.on("unlink", function(ipath) {update_img("delete", ipath)})

		watcher_thumb
			.on("add", function(ipath) {update_client(ipath)})
			.on("change", function(ipath) {update_client(ipath)})
			.on("unlink", function(ipath) {update_client(ipath)})
	});
}