module.exports = function(app, security) {
  var Event = require('../models/event')
  , access = require('../access')
  , api = require('../api')
  , archiver = require('archiver')
  , fs = require('fs-extra')
  , Zip = require('adm-zip');

  var passport = security.authentication.passport;

  app.all('/api/events*', passport.authenticate('bearer'));

  function validateEventParams(req, res, next) {
    var event = req.body;

    if (!event.name) {
      return res.status(400).send("cannot create event 'name' param not specified");
    }

    req.newEvent = event;
    next();
  }

  function validateEventAccess(req, res, next) {
    if (access.userHasPermission(req.user, 'READ_LOCATION_ALL')) {
      next();
    } else if (access.userHasPermission(req.user, 'READ_LOCATION_EVENT')) {
      // Make sure I am part of this event
      Event.eventHasUser(req.event, req.user._id, function(err, eventHasUser) {
        eventHasUser ? next() : res.sendStatus(403);
      });
    } else {
      res.sendStatus(403);
    }
  }

  function parseEventQueryParams(req, res, next) {
    var parameters = {};
    parameters.userId = req.param('userId');

    parameters.populate = true;
    if (req.query.populate === 'false') parameters.populate = false;

    req.parameters = parameters;

    next();
  }

  function validateFormParams(req, res, next) {
    var form = req.body.form;

    // check for required fields
    var fields = form.fields;
    if (!fields) return res.status(400).send('fields is required');

    var fieldNames = {};
    fields.forEach(function(field) {
      fieldNames[field.name] = field;
    });

    var missing = [];
    if (fieldNames.timestamp == null) missing.push("'timestamp' missing field is required");
    if (fieldNames.geometry == null) missing.push("'geometry' missing field is required");
    if (fieldNames.type == null) missing.push("'type' missing field is required");
    if (missing.length) return res.status(400).send(missing.join(","));

    var required = [];
    if (!fieldNames.timestamp.required) required.push("'timestamp' required property must be true");
    if (!fieldNames.geometry.required) required.push("'geometry' required property must be true");
    if (!fieldNames.type.required) required.push("'type' required property must be true");
    if (required.length) return res.status(400).send(required.join(","));

    next();
  }

  app.get(
    '/api/events',
    parseEventQueryParams,
    function (req, res, next) {
      var filter = {};
      if (req.parameters.userId) filter.userId = req.parameters.userId;
      if (access.userHasPermission(req.user, 'READ_EVENT_ALL')) {
        Event.getEvents({filter: filter, populate: req.parameters.populate}, function(err, events) {
          if (err) return next(err);
          res.json(events);
        });
      } else if (access.userHasPermission(req.user, 'READ_EVENT_USER')) {
        Event.getEvents({access: {userId: req.user._id}, filter: filter, populate: req.parameters.populate}, function(err, events) {
          if (err) return next(err);
          res.json(events);
        });
      } else {
        // No valid READ EVENT permission
        res.sendStatus(403);
      }
    }
  );

  app.get(
    '/api/events/count',
    access.authorize('READ_EVENT_ALL'),
    function(req, res, next) {
      Event.count(function(err, count) {
        if (err) return next(err);

        return res.json({count: count});
      });
    }
  );

  app.get(
    '/api/events/:id',
    parseEventQueryParams,
    function (req, res, next) {
      if (access.userHasPermission(req.user, 'READ_EVENT_ALL')) {
        Event.getById(req.params.id, {populate: req.parameters.populate}, function(err, event) {
          if (err) return next(err);
          res.json(event);
        });
      } else if (access.userHasPermission(req.user, 'READ_EVENT_USER')) {
        Event.getById(req.params.id, {access: {userId: req.user._id}, populate: req.parameters.populate}, function(err, event) {
          if (err) return next(err);
          if (!event) return res.sendStatus(404);
          res.json(event);
        });
      } else {
        // No valid READ EVENT permission
        res.sendStatus(403);
      }
    }
  );

  app.post(
    '/api/events',
    access.authorize('CREATE_EVENT'),
    parseEventQueryParams,
    validateEventParams,
    function(req, res, next) {
      if (!req.is('multipart/form-data')) return next();

      if (req.newEvent.teamIds) {
        req.newEvent.teamIds = req.newEvent.teamIds.split(",");
      }

      if (req.newEvent.layerIds) {
        req.newEvent.layerIds = req.newEvent.layerIds.split(",");
      }

      Event.create(req.newEvent, function(err, event) {
        if (err) return next(err);

        new api.Form(event).import(req.files.form, function(err, form) {
          if (err) return next(err);

          Event.update(event._id, {form: form}, function(err, event) {
            if (err) return next(err);

            res.status(201).json(event);
          });
        });
      });
    }
  );

  app.post(
    '/api/events',
    access.authorize('CREATE_EVENT'),
    parseEventQueryParams,
    validateEventParams,
    validateFormParams,
    function(req, res, next) {
      Event.create(req.newEvent, function(err, event) {
        if (err) return next(err);

        //copy default icon into new event directory
        // TODO test this, was id changed to _id
        new api.Icon(event._id).setDefaultIcon(function(err) {
          if (err) return next(err);

          res.status(201).json(event);
        });
      });
    }
  );

  app.put(
    '/api/events/:eventId',
    access.authorize('UPDATE_EVENT'),
    parseEventQueryParams,
    validateEventParams,
    function(req, res, next) {
      Event.update(req.event._id, req.newEvent, {populate: req.parameters.populate}, function(err, event) {
        if (err) return next(err);

        res.json(event);
      });
    }
  );

  app.delete(
    '/api/events/:eventId',
    access.authorize('DELETE_EVENT'),
    function(req, res, next) {
      Event.remove(req.event, function(err, event) {
        if (err) return next(err);

        res.status(204).send();
      });
    }
  );

  app.post(
    '/api/events/:eventId/teams',
    access.authorize('UPDATE_EVENT'),
    function(req, res, next) {
      Event.addTeam(req.event, req.body, function(err, event) {
        if (err) return next(err);

        res.json(event);
      });
    }
  );

  app.delete(
    '/api/events/:eventId/teams/:id',
    access.authorize('UPDATE_EVENT'),
    function(req, res, next) {
      Event.removeTeam(req.event, {id: req.params.id}, function(err, event) {
        if (err) return next(err);

        res.json(event);
      });
    }
  );

  app.post(
    '/api/events/:eventId/layers',
    access.authorize('UPDATE_EVENT'),
    function(req, res, next) {
      Event.addLayer(req.event, req.body, function(err, event) {
        if (err) return next(err);

        res.json(event);
      });
    }
  );

  app.delete(
    '/api/events/:eventId/layers/:id',
    access.authorize('UPDATE_EVENT'),
    function(req, res, next) {
      Event.removeLayer(req.event, {id: req.params.id}, function(err, event) {
        if (err) return next(err);

        res.json(event);
      });
    }
  );

  // export a zip of the form json and icons
  app.get(
    '/api/events/:eventId/form.zip',
    validateEventAccess,
    function(req, res, next) {
      new api.Form(req.event).export(function(err, file) {
        if (err) return next(err);

        res.attachment(req.event.name + "-form.zip");
        file.pipe(res);
      });
    }
  );

  app.get(
    '/api/events/:eventId/form/icons.zip',
    validateEventAccess,
    function(req, res, next) {
      var iconBasePath = new api.Icon(req.event._id).getBasePath();
      var archive = archiver('zip');
      res.attachment("icons.zip");
      archive.pipe(res);
      archive.bulk([{src: ['**'], dest: '/icons', expand: true, cwd: iconBasePath}]);
      archive.finalize();
    }
  );

  // get icon
  app.get(
    '/api/events/:eventId/form/icons/:type?/:variant?',
    validateEventAccess,
    function(req, res, next) {
      new api.Icon(req.event._id, req.params.type, req.params.variant).getIcon(function(err, iconPath) {
        if (err || !iconPath) return next();

        res.sendFile(iconPath);
      });
    }
  );

  app.get(
    '/api/events/:eventId/form/icons*',
    validateEventAccess,
    function(req, res, next) {
      new api.Icon().getDefaultIcon(function(err, iconPath) {
        if (err) return next(err);

        if (!iconPath) return res.status(404).send();

        res.sendFile(iconPath);
      });
    }
  );

  // Create a new icon
  app.post(
    '/api/events/:eventId/form/icons/:type?/:variant?',
    access.authorize('CREATE_EVENT'),
    function(req, res, next) {
      new api.Icon(req.event._id, req.params.type, req.params.variant).create(req.files.icon, function(err, icon) {
        if (err) return next(err);

        return res.json(icon);
      });
    }
  );

  // Delete an icon
  app.delete(
    '/api/events/:eventId/form/icons/:type?/:variant?',
    access.authorize('DELETE_EVENT'),
    function(req, res) {
      new api.Icon(req.event._id, req.params.type, req.params.variant).delete(function(err, icon) {
        if (err) return next(err);

        return res.status(204).send();
      });
    }
  );
}
