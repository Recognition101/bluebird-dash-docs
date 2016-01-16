var http    = require("http");
var sqlite3 = require('sqlite3').verbose();
var fs      = require("fs-extra");
var request = require('request');
var cheerio = require('cheerio');

var requestP = function requestP(url) {
    return new Promise(function(res, rej) {
        request(url, function(err, resp, body) {
            return err ? rej(err) : res(body);
        });
    });
};
var writeFileP = function writeFileP(fn, data) {
    return new Promise(function(res, rej) {
        fs.writeFile(fn, data, function(err) {return err ? rej(err) : res();});
    });
};
var readFileP = function readFileP(fn) {
    return new Promise(function(res, rej) {
        fs.readFile(fn, function(err, d) {return err ? rej(err) : res(d);});
    });
};

var apiRoot   = 'http://bluebirdjs.com/docs/';
var apiUrl    = 'http://bluebirdjs.com/docs/api-reference.html';
var apiRelUrl = '/docs/api-reference.html';
var dirInit   = 'Bluebird.docset';
var dirStruct = 'Bluebird.docset/Contents/Resources/Documents/';
var docsFn    = 'Bluebird.docset/Contents/Resources/Documents/bb-api.html';
var dbFn      = 'Bluebird.docset/Contents/Resources/docSet.dsidx';
var plistFn   = 'Bluebird.docset/Contents/Info.plist';
var iconFn    = 'Bluebird.docset/icon.png';
var styleFn   = 'style.css';

//helper functions
var createDatabse = function(html) {
    var db = new sqlite3.Database(dbFn);
    var $ = cheerio.load(html);

    db.serialize(function() {
        db.run("CREATE TABLE searchIndex(id INTEGER PRIMARY KEY, name TEXT, " +
               "type TEXT, path TEXT);");
        db.run("CREATE UNIQUE INDEX anchor ON searchIndex (name,type,path);");

        var items = $('.header-anchor');
        var stmt = db.prepare("INSERT OR IGNORE INTO " +
                              "searchIndex(name, type, path) " +
                              "VALUES (?, ?, ?)");

        items.each(function(i, el) {
            var text = $(this).parent().text().trim();
            var type = text.indexOf('.') === 0 ? 'Method' :
                       text.indexOf('Promise.') === 0 ? 'Function' :
                       text.indexOf('new Promise') === 0 ? 'Class' : 'Guide';

            text = text.indexOf('.') === 0 ? text.substr(1) : text;
            text = text.indexOf('Promise.') === 0 ? text.substr(8) : text;
            text = text.indexOf('new ') === 0 ? text.substr(4) : text;

            stmt.run(text, type, 'bb-api.html' + $(this).attr('href'));
        });

        stmt.finalize();
    });

    db.close();
};

//program entry point
fs.remove(dirInit, function(err) {
    if (err) {return console.err(err);}

    fs.mkdirs(dirStruct, function(err) {
        if (err) {return console.err(err);}

        console.log('Copying resources...');
        fs.createReadStream('Info.plist').pipe(fs.createWriteStream(plistFn));
        fs.createReadStream('icon.png').pipe(fs.createWriteStream(iconFn));

        console.log('Downloading docs...');
        var allHtml = '';
        requestP(apiUrl).then(function(body) {
            var $ = cheerio.load(body);
            var promises = [];
            $('.api-reference-menu li a').each(function(i, el) {
                promises.push(requestP(apiRoot + $(this).attr('href')));
            });
            return Promise.all(promises);

        }).then(function(allResponses) {
            allResponses.forEach(function(html) {
                var $ = cheerio.load(html);
                $('.post-content a[href="'+apiRelUrl+'"]').parent().remove();
                allHtml += $('.post-content').html();
            });

            console.log('Parsing the DOM into SQL Index...');
            createDatabse(allHtml);

            console.log('Adding Styles...');
            return readFileP(styleFn);
        }).then(function(style) {

            console.log('Writing HTML...');
            return writeFileP(docsFn, '<!DOCTYPE html>\n<html>' +
                '<head>' +
                    '<title>Bluebird Docs</title>' +
                    '<style>' + style + '</style>' +
                '</head><body>' +
                    allHtml +
                '</body></html>');
        }).then(function() {
           console.log('Done!'); 

        }).catch(function(err) {
           console.error('Error!', err); 
        });
    });
});
