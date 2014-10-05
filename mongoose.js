var mongoose = require('mongoose');

console.log("Connecting to MongoDB");
mongoose.connect('mongodb://localhost/enCal');

module.exports = mongoose;
