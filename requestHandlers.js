var querystring = require("querystring");
var fs = require('fs');

function start(response, postData) {
    //console.log("Request handler 'start' was called.");

    /*
     Having view content right in the request handler is ugly. But here we go:
     */
    /*
    var body = '<html>'+
        '<head>'+
        '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />'+
        '</head>'+
        '<body>'+
        '<form action="/upload" method="post">'+
        '<textarea name="text" rows="20" cols="60"></textarea>'+
        '<input type="submit" value="Submit text" />'+
        '</form>'+
        '</body>'+
        '</html>';

    response.writeHead(200, {"Content-Type": "text/html"});
    response.write(body);
    response.end();
    */

    fs.readFile(__dirname + '/index.html',
        function (err, data) {
            if (err) {
                response.writeHead(500);
                return response.end('Error loading index.html');
            }

            response.writeHead(200);
            response.end(data);
        }
    );
    /*
    response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
    response.write('Nothing to see here. <a href="http://www.smokerel.com/space">Please move on</a>');
    response.end();
    */
}

function upload(response, postData) {
    //console.log("Request handler 'upload' was called.");
    response.writeHead(200, {"Content-Type": "text/plain"});
    response.write("You've sent the text: " + querystring.parse(postData).text);
    response.end();
}

function socketIOjs(response, postData){
    fs.readFile(__dirname + '/socket.io/socket.io.js',
        function (err, data) {
            if (err) {
                response.writeHead(500);
                return response.end('Error loading socket.io.js');
            }

            response.writeHead(200, {"Content-Type": "text/javascript"});
            response.end(data);
        }
    );
}

function raphaeljs(response, postData){
    fs.readFile(__dirname + '/raphael-min.js',
        function (err, data) {
            if (err) {
                response.writeHead(500);
                return response.end('Error loading raphael-min.js');
            }

            response.writeHead(200, {"Content-Type": "text/javascript"});
            response.end(data);
        }
    );
}

function shipimg(response, postData){
    fs.readFile(__dirname + '/ship01.png',
        function (err, data) {
            if (err) {
                response.writeHead(500);
                return response.end('Error loading ship01.png');
            }

            response.writeHead(200, {"Content-Type": "image/png"});
            response.end(data);
        }
    );
}

function box2DWeb(response, postData){
    fs.readFile(__dirname + '/Box2dWeb-2.1.a.3.min.js',
        function (err, data) {
            if (err) {
                response.writeHead(500);
                return response.end('Error loading /Box2dWeb-2.1.a.3.min.js');
            }

            response.writeHead(200, {"Content-Type": "text/javascript"});
            response.end(data);
        }
    );
}

function gameenginejs(response, postData){
    fs.readFile(__dirname + '/gameengine5.js',
        function (err, data) {
            if (err) {
                response.writeHead(500);
                return response.end('Error loading /gameengine5.js');
            }

            response.writeHead(200, {"Content-Type": "text/javascript"});
            response.end(data);
        }
    );
}

exports.start = start;
exports.upload = upload;
exports.socketIOjs = socketIOjs;
exports.raphaeljs = raphaeljs;
exports.shipimg = shipimg;
exports.box2DWeb = box2DWeb;
exports.gameenginejs = gameenginejs;