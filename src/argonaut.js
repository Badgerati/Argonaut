//modules
var fs = require('fs');
var isThere = require('is-there');
var querystring = require('querystring');
var https = require('https');
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

if (!syncMode && (callbackUrl == null || callbackUrl == '')) {
    throw 'Asyncronous running requires a URL be supplied.'
}

//check test file/directory exists
if (!isThere(tests)) {
    throw 'Tests file/directory doesn\'t exist: ' + tests
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
        run(null, data);
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
function run(err, data) {
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
        if (test == null) {
            return;
        }
        
        if (test.name == null || test.name == '') {
            return;
        }
        
        doCall(
            (test.url || url),
            (test.method || method).toUpperCase(),
            (test.responseType || responseType).toUpperCase(),
            test);
    });
}

function doCall(url, method, responseType, test) {
    var parameters = test.parameters;
    var expected = test.expected;
    var httpresponse = test.httpresponse;
    
    var purl = urlParser.parse(url);
    var host = purl.hostname;
    var path = purl.pathname;
    var protocol = purl.protocol.replace(':', '');

    if (method == 'GET') {
        path += ('?' + querystring.stringify(parameters));
    }
    
    var options = {
        host: host,
        path: path,
        method: method,
        port: (protocol == 'http' ? 80 : 443)
    };
    
    var req = https.request(options, function(res) {
        res.setEncoding('utf8');
        var code = res.statusCode;
        var msg = '';
        
        res.on('data', function(data) {
            msg += data;
        });
        
        res.on('end', function() {
            verify(msg, expected, responseType, code, httpresponse, test.name);
        });
    });
    
    req.end();
}

function verify(data, expected, responseType, httpcode, httpexpected, testname) {
    if (httpcode != httpexpected) {
        if (output) {
            log(testname, 'Incorrect HTTP Status Code\n  Expected\t' + httpexpected + '\n  But got\t' + httpcode);
        }
        
        return;
    }
    
    if (responseType == 'XML') {
        verifyXml(data, testname, expected);
    }
    else {
        verifyJson(data, testname, expected);
    }
}

function verifyXml(data, testname, expected) {
    parseXml(data, function(err, result) {
        if (err) {
            if (output) {
                log(testname, 'Invalid XML');
            }
            
            return;
        }
        
        expected.forEach(function(expect) {
            var key = Object.keys(expect)[0];
            var value = resolveJsonPath(result, key);
            
            if (value != expect[key]) {
                if (output) {
                    log(testname, 'Incorrect value for ' + key + '\n  Expected\t' + expect[key] + '\n  But got\t' + value);
                }
                
                return;
            }
        });
    });
}

function verifyJson(data, testname, expected) {
    
}

function log(testname, msg) {
    console.log('(' + testname + '):\n' + msg + '\n');
}