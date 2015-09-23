Argonaut
========
Argonaut is a node.js testing framework for testing REST API responses. Tests are written within a JSON file, and fed into the node.js script. Argonaut can run either asynchronously or synchronously, with the open of outputting data direct to the console (synchronous only), or to a callback URL (mandatory for async).

Argonaut is still in development, so will have missing features and be unstable.


Example JSON
============
Tests are written within JSON files, this lets you specify a global REST API URL to test, which can be overidden within the tests.

```json
{
    "url": "https://sometest.url.com/interfaces/Authenticate",
    "method": "GET",
    "responseType": "XML",
    "tests": [
        {
            "name": "Incorrect Username",
            "httpresponse": 200,
            "parameters": {
                "username": "completely_invalid"
            },
            "expected": [
                { "Response.ErrorCode": 500 }
            ]
        },
        {
            "name": "Incorrect User Password",
            "httpresponse": 200,
            "parameters": {
                "username": "valid_username",
                "password": "not_a_real_password"
            },
            "expected": [
                { "Response.ErrorCode": 500 }
            ]
        },
        {
            "name": "Correct User Credentials",
            "httpresponse": 200,
            "parameters": {
                "username": "valid_username",
                "password": "valid_password"
            },
            "expected": [
                { "Response.ErrorCode": 200 }
            ]
        }
    ]
}

```

As you may notice, the URL ends up being hardcoded in the JSON file. Hosts are not the same in every environment, therefore to override hosts within the JSON test files you can use a config.json file. The config JSON file can either be the default one located at the root of Argonaut, or a path to one can be specified using the -c tag.

An example to override two hosts would be:

```json
{
    "hosts": {
        "sometest.url.com": "other.url.com",
        "thistest.url.com": "thing.url.com"
    }
}
```

Now when Argonaut attempts to callout to 'sometest.url.com', this is replaced with 'other.url.com'. Making testing on other environments much easier.



Example Call
============
You can run a test JSON file directly like so:

```shell
node argonaut.js -t test.json
```

To run a batch of test JSON files contained within a directory (called say 'my_tests'), you would run the following. Argonaut will run all JSON files within the passed directory and any sub-directories within that:

```shell
node argonaut.js -t .\my_tests
```

If you run Argonaut without passing a test file/folder, then it will attempt to look in a default '.\tests' directory for test JSON files.

By default, Argonaut runs asynchronously. To run synchronously you pass the -s tag:

```shell
node argonaut.js -s
```

A callback URL is mandatory for async running, but optional for sync running. To pass a URL use the -u tag:

```shell
node argonaut.js -u some.callback.com
```

When running in sync mode, output is surpressed by default, if you wish for output to be logged to the console then you can pass the -o tag. Output cannot be enabled for async running.

```shell
node argonaut.js -o
```

To specify a config JSON file other than using the default one, you can use the -c tag:

```shell
node argonaut -c .\other_config.json
```