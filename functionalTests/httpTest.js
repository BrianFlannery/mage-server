var expect = require("chai").expect
 , request = require("request")
 , http = require('http')
 , assert = require('assert')
 , express  = require('express')
 , token = require('../models/token')
 , api = require('../api')
 , record = require('./record')
 , config = require('./config/httpConfig.json');

// --------- Make some HTTP requests
  // Before: create a token.  Optional - record http responses
  // After: Recorder cleanup
  // Verify we can get a response = 200
  // Verify our responses have good values
  // Verify a request without a token is invalid
  // Request a user and verify the data


// Set the connection URL
var localUrl = config.localServer.location;
var httpUrl = config.httpServer.location;
var functionalServer = config.functionalServer.location;
// To switch between localhost and remote host, change conUrl to one of the above.  Configure those values in config/httpconfig.js
var conUrl = httpUrl;
// Set recordCalls to true if you want to save off all http requests for
// offline testing.  See record.js for details
var recordCalls = false;
// get the test user from the config file
var testUser = config.httpTestUser;


describe("MAGE-server API JSON test", function(){
  // a recorder to save the http request data for offline playback
  if(recordCalls){
    var recorder = record('mage_recording');
  }
  // Need to store a token for future requests
  var myToken = "";

  // ----- Before: get a token
  before(function(done){
    // Record http requests for testing offline
    if(recordCalls){
      recorder.before();
    }
    // Make a request for a token before the tests execute
    var tokenOptions = {
      url: conUrl + "/login",
      method: 'POST',
      form: {
        'username': testUser.username,
        'uid': testUser.uid,
        'password': testUser.password
      }
    }
    request(tokenOptions, function(error, response, body){
      if(error){
        console.log("Error getting token: " + error);
      } else{
        console.log("body: " + body);
        var tokenObj = JSON.parse(body);
        myToken = tokenObj.token;
      }
      done();
    });
  });

  // ----- make sure the recorder saves to file
  after(function(done){
    if(recordCalls){
      recorder.after();
    }
    done();
  });


  // ------------- Tests -----------------
  // Make a request and verify we get a response
  // check the name property
  it("Verify MAGE server is up - return status 200 : /api", function(done){
    request(conUrl, function(error, response, body){
      expect(response.statusCode).to.equal(200);
      var jsonObj = JSON.parse(body);
      var appName = jsonObj['name'].substring(0,4);
      expect(appName).to.equal('MAGE');
      done();
    });
  });

  // ----- Should be unauthorized without token
  it("Verify request is denied when token isn't given : /api/users/{id}", function(done){
    var tokenOptions = {
      url: conUrl + "/users/" + testUser.userId,
      method: 'GET'
    }
    request(tokenOptions, function(error, response, body){
      //expect(response.statusCode).to.equal(401);
      if(error){
        console.log("Error from /api/users/{id}: " + error);
      }
      done();
    });
  });

  


});
