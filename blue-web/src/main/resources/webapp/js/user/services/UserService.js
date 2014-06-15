angular.module("bluelatex.User.Services.User", ["ngResource", 'jmdobry.angular-cache', 'bluelatex.Configuration'])
  .factory("UserService", ['$resource', '$http', '$log', '$angularCacheFactory', '$q', 'api_prefix',
      function ($resource, $http, $log, $angularCacheFactory, $q, api_prefix) {
        // userCache
        var _dataCache = $angularCacheFactory('userCache', {
          maxAge: 300000,
          storageMode: 'localStorage',
          deleteOnExpire: 'aggressive',
          verifyIntegrity: true
        });

        var password = $resource(api_prefix + "/users/:username/reset", {
          username: "@username"
        }, {
          "getToken": {
            method: "get",
            transformResponse: [
              function (data, headersGetter) {
                return {response: JSON.parse(data)};
              }
            ].concat($http.defaults.transformResponse)
          },
          "reset": {
            'method': 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        });
        var users = $resource(api_prefix + "/users", {}, {
          "get": {
            method: "get",
            format: 'json',
            isArray: true,
            transformResponse: [
              function (data, headersGetter) {
                var users = [];
                data = JSON.parse(data);
                for (var i = 0; i < data.length; i++) {
                  var user = data[i];
                  users.push({
                    name: user
                  });
                };
                return users;
              }
            ].concat($http.defaults.transformResponse)
          }
        });
        var info = $resource(api_prefix + "/users/:username/info", {
          username: "@username"
        }, {
          "get": {
            method: "get",
            format: 'json',
            transformResponse: [

              function (data, headersGetter) {
                data = JSON.parse(data);
                var headers = headersGetter();
                data.etag = headers.etag;
                return data;
              }
            ].concat($http.defaults.transformResponse)
          },
          "modify": {
            'method': 'PATCH',
            headers: {
              'Content-Type': 'application/json-patch'
            },
            transformRequest: [
              function (data, headersGetter) {
                var header = headersGetter();
                header['If-Match'] = data.etag;
                return data.path_json;
              }
            ].concat($http.defaults.transformRequest)
          }
        });
        var register = $resource(api_prefix + "/users", null, {
          "register": {
            method: "POST",
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            }
          }
        });
        var removeUser = $resource(api_prefix + "/users/:username", {
          username: "@username"
        }, {
          "remove": {
            'method': 'DELETE'
          }
        });
        return {
          getPasswordToken: function (username) {
            return password.getToken({
              username: username
            }).$promise;
          },
          resetPassword: function (username, reset_token, new_password1, new_password2) {
            return password.reset({
              username: username
            }, jsonToPostParameters({
              reset_token: reset_token,
              new_password1: new_password1,
              new_password2: new_password2
            })).$promise;
          },
          getInfo: function (user) {
            var deferred = $q.defer();
            var promise = deferred.promise;
            if (_dataCache.get('/users/' + user.name)) deferred.resolve(_dataCache.get('/users/' + user.name));
            else {
              info.get({
                username: user.name
              }).$promise.then(function (data) {
                _dataCache.put('/users/' + user.name, data);
                deferred.resolve(data);
              }, function (error) {
                $log.error(error);
                deferred.reject(error);
              }, function (progress) {
                deferred.notify(progress);
              });
            }
            return promise;
          },
          getUsers: function (search) {
            var deferred = $q.defer();
            var promise = deferred.promise;
            if (_dataCache.get('/users')) deferred.resolve(_dataCache.get('/users'));
            else {
              users.get({},{name: search}).$promise.then(function (data) {
                if(search==null)
                  _dataCache.put('/users', data);
                deferred.resolve(data);
              }, function (error) {
                $log.error(error);
                deferred.reject(error);
              }, function (progress) {
                deferred.notify(progress);
              });
            }
            return promise;
          },
          save: function (user, olduser) {
            var etag = olduser.etag;
            var path_json = jsonpatch.compare(olduser,user);
            var deferred = $q.defer();
            var promise = deferred.promise;
            _dataCache.remove('/users/' + user.name);
            info.modify({
              username: user.name
            }, {
              "etag": etag,
              path_json: path_json
            }).$promise.then(function (data) {
              deferred.resolve(data);
            }, function (error) {
              $log.error(error);
              deferred.reject(error);
            }, function (progress) {
              deferred.notify(progress);
            });
            return promise;
          },
          register: function (user) {
            return register.register({}, jsonToPostParameters(user)).$promise;
          },
          remove: function (user) {
            var deferred = $q.defer();
            var promise = deferred.promise;
            removeUser.remove({
              username: user.username
            }, user).$promise.then(function (data) {
              _dataCache.remove('/users/' + user.username);
              deferred.resolve(data);
            }, function (error) {
              $log.error(error);
              deferred.reject(error);
            }, function (progress) {
              deferred.notify(progress);
            });
            return promise;
          },
          clearCache: function() {
            $angularCacheFactory.clearAll();
          }
        };
      }
    ]);