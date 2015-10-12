module.exports = function(app, p***REMOVED***port, provisioning, localStrategy) {

  var log = require('winston')
    , LocalStrategy = require('p***REMOVED***port-local').Strategy
    , User = require('../models/user')
    , Device = require('../models/device')
    , api = require('../api')
    , userTransformer = require('../transformers/user');

  p***REMOVED***port.use(new LocalStrategy(
    function(username, p***REMOVED***word, done) {
      User.getUserByUsername(username, function(err, user) {
        if (err) { return done(err); }

        if (!user) {
          log.warn('Failed login attempt: User with username ' + username + ' not found');
          return done(null, false, { message: "User with username '" + username + "' not found" });
        }

        if (!user.active) {
          log.warn('Failed user login attempt: User ' + user.username + ' is not active');
          return done(null, false, { message: "User with username '" + username + "' not active" });
        }

        user.validP***REMOVED***word(p***REMOVED***word, function(err, isValid) {
          if (err) {
            return done(err);
          }

          if (!isValid) {
            log.warn('Failed login attempt: User with username ' + username + ' provided an invalid p***REMOVED***word');
            return done(null, false);
          }

          return done(null, user);
        });
      });
    }
  ));

  app.post(
    '/api/login',
    p***REMOVED***port.authenticate('local'),
    provisioning.provision.check(provisioning.strategy),
    function(req, res) {
      var options = {userAgent: req.headers['user-agent'], appVersion: req.param('appVersion')};
      new api.User().login(req.user,  req.provisionedDevice, options, function(err, token) {
        res.json({
          token: token.token,
          expirationDate: token.expirationDate,
          user: userTransformer.transform(req.user, {path: req.getRoot()})
        });
      });
    }
  );


  // Create a new device
  // Any authenticated user can create a new device, the registered field
  // will be set to false.
  app.post(
    '/api/devices',
    p***REMOVED***port.authenticate('local'),
    function(req, res) {
      var newDevice = {
        uid: req.param('uid'),
        name: req.param('name'),
        registered: false,
        description: req.param('description'),
        userId: req.user.id
      };

      if (!newDevice.uid) return res.send(401, "missing required param 'uid'");

      Device.getDeviceByUid(newDevice.uid, function(err, device) {
        if (device) {
          // already exists, do not register
          return res.json(device);
        }

        Device.createDevice(newDevice, function(err, newDevice) {
          if (err) {
            return res.send(400, err);
          }

          res.json(newDevice);
        });
      });
    }
  );
}
