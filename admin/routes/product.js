const express = require('express');
const mongoose = require('mongoose');

const FX = require('../../utils/functions');
const vrules = require('../../validation');

const router = express.Router();
const User = mongoose.model('User');
const { Types: { ObjectId } } = mongoose;

router.get('/products', FX.adminAuth, (req, res, next) => {
    User.find(
	  {
		isArchive: false,
		isApproved: true,
	  },
	  '_id name',
	).then(brand => {
      res.render('product.html', { brand });
    }).catch(err => next(err));
});

router.post('/products/find', FX.adminAuth, (req,res,next) => {
	const { length, start } = req.body;
	const sort = {};
	const search_arr = ['mobileNumber'];
	const sort_arr = ['isApproved', 'name', 'gender', 'dateOfBirth', 'dateOfMarriage'];
	const query = { isArchive: false, isAdmin: false };

	const sort_key = sort_arr[parseInt(req.body['order[0][column]'])];
	const sort_val = req.body['order[0][dir]'] === 'asc' ? 1: -1;
	sort[sort_key] = sort_val;
	const limit = parseInt(length) > 0 ? parseInt(length): '';

    if (req.body['search[value]']) {
      query['$or'] = [];
      search_arr.forEach(field => {
        const obj = {};
        obj[field] = {
          '$regex': req.body['search[value]'],
          '$options': 'i',
        };
        query['$or'].push(obj);
	  });
	}

    User.count(query)
    .then(result1 => {
      User.find(query)
      .sort(sort)
      .skip(parseInt(start))
      .limit(limit)
      .then(result => {
		console.log('result length /products/find =======>', result);
        // User.populate(
		//   result,
		//   [
		// 	{ path:'headId', select:'name' },
		// 	{ path:'primaryContactId', select:'name' },
		//   ],
		// )
		// .then(result => {
          res.json({
            recordsFiltered: result1,
            recordsTotal: result.length,
            data:result,
          });
        // }).catch(err => next(err));
	  }).catch(err => next(err));
	}).catch(err => next(err));
});

router.post('/products/add',FX.adminAuth,function(req,res,next){
    Product.create(req.body).then(result => {
		if (result) {
			res.redirect('/admin/products');
			Brand.findByIdAndUpdate(req.body.brand,{$inc:{qty:1}})
			.catch(err => next(err));
		}
    }).catch(err => next(err));
});

router.post('/products/edit', FX.adminAuth, function(req,res,next){
	var {id,brand,...body}=req.body;
    Product.findByIdAndUpdate(id,{$set:{brand:ObjectId(brand),...body}})
	.then(() => {
        res.redirect('/admin/products');        
    }).catch(err => next(err));
});

router.get('/products/delete/:id', FX.adminAuth, function(req,res,next){
	Product.findByIdAndUpdate(req.params.id,{$set:{isArchive:true}}, result => {
		if (result) {
			res.status(200).json({message:`product deleted`});
			Brand.findByIdAndUpdate(result.brand,{$inc:{qty:-1}})
			.catch(err => next(err));
		}
	}).catch(err => next(err));
});

module.exports = router;
