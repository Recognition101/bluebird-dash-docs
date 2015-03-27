var http = require("http");

var marked = require("marked");
var request = require("request");
var sqlite3 = require('sqlite3').verbose();
var jsdom = require("jsdom");
var fs = require("fs-extra");
var ent = require("ent");
marked.setOptions({
    gfm: true,
    tables: true,
    breaks: true
});

var apiUrl = "https://raw.github.com/petkaantonov/bluebird/master/API.md";
var dirInit   = "Bluebird.docset";
var dirStruct = "Bluebird.docset/Contents/Resources/Documents/";
var docsFn    = "Bluebird.docset/Contents/Resources/Documents/bb-api.html";
var dbFn      = "Bluebird.docset/Contents/Resources/docSet.dsidx";
var plistFn   = "Bluebird.docset/Contents/Info.plist"
var iconFn   = "Bluebird.docset/icon.png"
var html = "";

var renderer = new marked.Renderer();
renderer.heading = function (text, level) {
    var escapedText = ent.decode(text).toLowerCase()
        .replace(/<\/?code>/g, "")
        .replace(/[\[\]\(\)<>,\.\|]/g, "")
        .replace(/\s/g, "-");
    return '<h' + level + '>' + 
            '<a name="' + escapedText + '" class="anchor" ' +
                'href="#' + escapedText +'">' + 
                '<span class="header-link"></span></a>' + text +
           '</h' + level + '>';
};


//helper functions
var getHash = function(url) {
    return url.substr(url.indexOf("#"));
};

//main program flow
var readCSS = function() {
    console.log("Reading style.css file...");
    fs.readFile("style.css", getApiDocs);
};

var getApiDocs = function(err, style) {
    if (err) {return console.err(err);}
    console.log("Requesting Bluebird API Docs and converting to HTML...");
    
    style = "<style>" + style + "</style>";

    request(apiUrl, function(err, resp, body) {
        if (err) {return console.err(err);}

        html = "<!DOCTYPE html><html>" +
                    "<head><title>Bluebird Docs</title>" + style + "</head>" +
                    "<body>" + marked(body, {renderer: renderer}) + "</body>" +
               "</html>";
        fs.writeFile(docsFn, html, parseHtml);
    });
};
var parseHtml = function(err) {
    if (err) {return console.err(err);}
    console.log("Parsing the HTML into DOM...");

    jsdom.env({
        html: html,
        done: createDatabse
    });
};
var createDatabse = function(err, window) {
    if (err) {return console.err(err);}
    console.log("Parsing the DOM into SQL Index...");

    var db = new sqlite3.Database(dbFn);
    var $ = window.document.body.querySelectorAll.bind(
        window.document.body);

    db.serialize(function() {
        db.run("CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, " +
               "type TEXT, path TEXT);");
        db.run("CREATE UNIQUE INDEX anchor ON searchIndex (name, type, path);");

        var items = $("h1 ~ ul > li > ul > li > a");
        var stmt = db.prepare("INSERT OR IGNORE INTO " +
                              "searchIndex(name, type, path) " +
                              "VALUES (?, ?, ?)");
        for(var i = 0; i < items.length; i+=1) {
            stmt.run(items[i].childNodes[0].textContent,
                     "Function",
                     "bb-api.html" + getHash(items[i].href));
        }
        stmt.finalize();
    });

    db.close();
};

//program entry point
fs.remove(dirInit, function(err) {
    if (err) {return console.err(err);}

    fs.mkdirs(dirStruct, function(err) {
        if (err) {return console.err(err);}

        fs.createReadStream('Info.plist').pipe(fs.createWriteStream(plistFn));
        fs.createReadStream('icon.png').pipe(fs.createWriteStream(iconFn));
        readCSS();
    });
});
