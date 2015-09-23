//modules
var fs = require('fs');
var isThere = require('is-there');
var querystring = require('querystring');
var https = require('https');
var http = require('http');
var parseXml = require('xml2js').parseString;
var resolveJsonPath = require('object-resolve-path');
var urlParser = require('url');
var argv = require('minimist')(process.argv.slice(2));

console.log();

//set supplied parameters
var tests = argv['t'] || './tests';
var callbackUrl = argv['u'];
var syncMode = argv['s'] || false;
var output = (argv['o'] || false) && syncMode;
var configPath = argv['c'] || './config.json';

if (!syncMode && (callbackUrl == null || callbackUrl == '')) {
    throw 'Asyncronous running requires a URL be supplied.'
}

//split up the callback URL
var curl, callbackhost, callbackpath, callbackprotocol, callbackport;
if (callbackUrl != null && callbackUrl != '') {
    curl = urlParser.parse(callbackUrl);
    callbackhost = curl.hostname;
    callbackpath = curl.pathname;
    callbackprotocol = curl.protocol.replace(':', '').toLowerCase();
    callbackport = curl.port || (callbackprotocol == 'http' ? 80 : 443);
}

//check test file/directory exists
if (!isThere(tests)) {
    throw 'Tests file/directory doesn\'t exist: ' + tests
}

//check config file for overrides
var config = null;
if (isThere(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

//do we have a file or a directory
var files = [];
if (fs.lstatSync(tests).isFile()) {
    files.push(tests);
}
else {
    files = walk(tests, files);
}

if (files == null || files.length == 0) {
    throw 'No test files found.'
}

//loop through files, running tests
files.forEach(function(file) {
    if (syncMode) {
        var data = fs.readFileSync(file, 'utf8');
        run(null, data, file);
    }
    else {
        fs.readFile(file, 'utf8', run);
    }
});



//returns the files in the passed folder and its sub-folders
function walk(dir, _files) {
    _files = _files || [];
    var files = fs.readdirSync(dir);
    
    for (var i in files) {
        var name = dir + '/' + files[i];
        
        if (fs.statSync(name).isDirectory()) {
            walk(name, _files);
        }
        else {
            _files.push(name);
        }
    }
    
    return _files;
}

//main callback for reading a file. Parses the JSON and runs the tests
function run(err, data, filepath) {
    if (err) {
        return;
    }
	
    var json = null;
    try {
        json = JSON.parse(data);
    }
    catch (err) {
        return;
    }
    
    var url = json.url;
    var method = json.method || 'GET';
    var responseType = json.responseType || 'XML';
    var tests = json.tests;
    
    if (tests == null || tests.length == 0) {
        return;
    }
    
    tests.forEach(function(test) {
        if (test == null || test.name == null || test.name == '') {
            return;
        }
        
        doCall(
            (test.url || url),
            (test.method || method).toUpperCase(),
            (test.responseType || responseType).toUpperCase(),
            test,
            filepath);
    });
}

//make the call to the passed URL, with parameters
function doCall(url, method, responseType, test, filepath) {
    var parameters = test.parameters;
    var expected = test.expected;
    var httpresponse = test.httpresponse;
    
    var purl = urlParser.parse(url);
    var host = purl.hostname;
    var path = purl.pathname;
    var protocol = purl.protocol.replace(':', '').toLowerCase();
    var port = purl.port || (protocol == 'http' ? 80 : 443);

    if (config && config.hosts && config.hosts[host]) {
        host = config.hosts[host];
    }

    if (method == 'GET') {
        path += ('?' + querystring.stringify(parameters));
    }
    
    var options = {
        host: host,
        path: path,
        method: method,
        port: port
    };
    
    var caller = protocol == 'http' ? http : https;
    var req = caller.request(options, function(res) {
        res.setEncoding('utf8');
        var code = res.statusCode;
        var msg = '';
        
        res.on('data', function(data) {
            msg += data;
        });
        
        res.on('end', function() {
            if (code != httpresponse) {
                log(test.name, filepath, 'Incorrect HTTP Status Code\n  Expected\t' + httpresponse + '\n  But got\t' + code);
            }
            else {
                verify(msg, expected, responseType, test.name, filepath);
            }
        });
    });
    
    req.on('error', function(e) {
        log(test.name, filepath, 'Unexpected error occurred during web request:\n' + e);
    });
    
    req.end();
}

//check the response we get back, against what we expect
function verify(data, expected, responseType, testname, filepath) {
    if (responseType == 'XML') {
        verifyXml(data, testname, expected, filepath);
    }
    else {
        verifyJson(data, testname, expected, filepath);
    }
}

//checks the XML response
function verifyXml(data, testname, expected, filepath) {
    parseXml(data, function(err, result) {
        if (err) {
            log(testname, filepath, 'Invalid XML');
            return;
        }
        
        expected.forEach(function(expect) {
            var key = Object.keys(expect)[0];
            var value = resolveJsonPath(result, key);
            
            if (value != expect[key]) {
                log(testname, filepath, 'Incorrect value for ' + key + '\n  Expected\t' + expect[key] + '\n  But got\t' + value);
                return;
            }
        });
    });
}

//checks the JSON response
function verifyJson(data, testname, expected) {
    
}

//logs any output to the console and/or to the callback URL
function log(testname, filepath, msg) {
    filepath = filepath || '';
    if (filepath != '') {
        filepath = 'Path: ' + filepath + '\n';
    }
    
    if (output) {
        console.log('Test: ' + testname + ':\n' + filepath + msg + '\n');
    }
    
    if (callbackUrl != null && callbackUrl != '') {
        var url = callbackpath
            + '?test=' + encodeURIComponent(testname)
            + '&response=' + encodeURIComponent(msg);
        
        var options = {
            host: callbackhost,
            path: url,
            method: 'GET',
            port: callbackport
        };
        
        var caller = callbackprotocol == 'http' ? http : https;
        var req = caller.request(options, function(res) { });
        req.on('error', function(e) { });
        req.end();
    }
}