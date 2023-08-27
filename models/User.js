const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const { Schema } = mongoose;

const userSchema = new Schema({
  picture: {
    type: String,
    default: '',
  },
  name: {
    type: String,
    default: '',
  },
  gender: {
    type: String,
    default: '',
  },
  occupation: {
    type: String,
    default: '',
  },
  gotra: {
    type: String,
    default: '',
  },
  contactNumber: {
    type: String,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  dateOfMarriage: {
    type: Date,
    default: null,
  },
  address: {
    type: String,
    default: '',
  },
  head: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  primaryContact: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  password:  String,
  isApproved: {
    type: Boolean,
    default: false,
  },
  isAdmin: {
    type: Boolean, // true for Administrator
    default: false,
  },
  isArchive: {
    type: Boolean,
    default: false,
  },
},
{
  timestamps: {
    createdAt: 'created',
    updatedAt: 'updated',
  },
  id: false,
  toJSON: {
    getters: true,
    virtuals: true,
  },
  toObject: {
    getters: true,
    virtuals: true,
  },
});

userSchema.methods.comparePassword = function (candidatePassword, cb) {
  bcrypt.compare(candidatePassword, this.password, (err, isMatch) => {
    return cb(err, isMatch);
  });
}

module.exports = mongoose.model('User', userSchema);
