var mongoose = require('./mongoose');

var userSchema = new mongoose.Schema({
    email: String,
    accessToken: String
});

userSchema.statics.updateOrCreate = function (email, accessToken, callback) {
    var that = this;

    // try to check if user already exists
    that.findOne({email: email}, function (err, result) {
        if (!err && result) {
            // user already exists, update token
            result.update({accessToken: accessToken}, function(err) {
                callback(err, result);
            });
        } else {
            // create new user in database
            var user = new that({
                email: email,
                accessToken: accessToken
            });
            //console.log('New user:', user);
            //save the user
            user.save(function(err) {
                callback(err, user);
            });
        }
    });
};

module.exports = mongoose.model('user', userSchema);
