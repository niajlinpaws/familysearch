const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const FX = require('../../utils/functions');
const vrules = require('../../validation');

const router = express.Router();
const User = mongoose.model('User');

router.all('/', FX.Auth, (req, res, next) => {
  const data = {};
//   let lastMonth = new Date(new Date(new Date().setDate(1)).toISOString().substring(0,10));
  Promise.all([
    // User.count({isAdmin:false,isBusiness:false,isArchive:false}),
    // User.count({isAdmin:false,isBusiness:true,isArchive:false}),
    // User.count({isAdmin:false,isBusiness:false,isArchive:false,created:{$gte:lastMonth}}),
    // User.count({isAdmin:false,isBusiness:true,isArchive:false,created:{$gte:lastMonth}}),
    // Event.count({isArchive:false}),
    // Event.count({isArchive:false,created:{$gte:lastMonth}}),
    // Event.count({isArchive:false,status:true,approved:true})
  ])
  .then(done => {
    // data.userCount = done[0];
    // data.businessUserCount = done[1];
    // data.lastMonthUserCount = done[2];
    // data.lastMonthBusinessUserCount = done[3];
    // data.eventCount = done[4];
    // data.lastMonthEventCount = done[5];
    // data.activeEventCount = done[6];
    return res.render('dashboard.html', { data });	
  })
  .catch(err => next(err));
});


router.all('/logout', (req, res) => {
	req.session.destroy;
	// Deletes the cookie.
	delete req.session.user;
	req.flash('success', 'Your are successfully logged out.');
	res.redirect('/admin/login');
});

router.get('/changePassword', FX.Auth, (req,res) => res.render('change_password.html'));

router.post('/changePassword', FX.Auth, FX.validate(vrules.changePassword, 'change_password.html'), (req, res, next) => {
  const { user } = req.session;

  bcrypt.compare(req.body.password, user.password, (err, isMatched) => {
    if (err) return next(err);
    if (!isMatched) {
      req.flash('error', 'Incorrect Password');
      return res.redirect('/admin/changePassword');
    }

    User.findOneAndUpdate(
	  { _id: user._id },
	  {
		$set: {
		  password: bcrypt.hashSync(req.body.new_password, bcrypt.genSaltSync(10)),
		},
	  },
	  { new: true },
	)
	  .then(() => res.redirect('/admin/users'))
	  .catch(err => next(err));
  });
});

module.exports = router;
