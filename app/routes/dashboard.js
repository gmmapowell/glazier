var DashboardRoute = Ember.Route.extend({
  serialize: function (object, params) {
    var parts = object.split('/'),
        hash = {};
    Ember.assert(parts.length === 2 && params.length === 2, 'parts should equal params');
    hash[params[0]] = parts[0];
    hash[params[1]] = parts[1];
    return hash;
  },

  deserialize: function (hash) {
    return hash.github_user + '/' + hash.github_repo;
  }
});

export DashboardRoute;
