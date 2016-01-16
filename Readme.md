## Dash Documentation Generator for Bluebird

This is a small script that will download the API documentation for the
[Bluebird](https://github.com/petkaantonov/bluebird) library and generate
the documentation index that can be read by the OSX program
[Dash](http://kapeli.com/dash).

It pulls from 
[this](http://bluebirdjs.com/docs/api-reference.html) API 
Documentation file.

## Install

```sh
#install dependencies
npm install

#run the generator
node bluebird-dash-docs.js
```

From there, you can double click on the generated "Bluebird.docset" file,
which will make Dash prompt you to add the documentation.
