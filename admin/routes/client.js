const express = require('express');

const FX = require('../../utils/functions');

const router = express.Router();

router.get('/clients', FX.adminAuth, (req, res) => res.render('client.html'));

router.post('/clients/find', FX.adminAuth, (req,res,next) => {
	const { length, start } = req.body;
	const sort = {};
	search_arr = ['name', 'city'];
	sort_arr = ['_id', 'name', 'city'];
	query = { isArchive:false };

	const sort_key = sort_arr[parseInt(req.body['order[0][column]'])];
	const sort_val = req.body['order[0][dir]'] === 'asc' ? 1 : -1;
	sort[sort_key] = sort_val;
	const limit = parseInt(length) > 0 ? parseInt(length): '';

	if (req.body['search[value]']) {
		query['$or'] = [];
		search_arr.forEach(field => {
			const obj = {};
			obj[field] =
			{
		   	    '$regex': req.body['search[value]'],
		        '$options': 'i',
		    } 
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
		  res.json({
			recordsFiltered: result1,
			recordsTotal: result.length,
			data: result,
		  });
		})
		.catch(err => next(err));
	})
	.catch(err => next(err));
});

router.post('/clients/add', FX.adminAuth, (req,res,next) => {
    User.create(req.body,function(err,result){
        if(err)return next(err);
        if(result)
        res.redirect('/admin/clients');
    });
});

router.post('/clients/edit',FX.adminAuth,function(req,res,next){
	var {id,...body}=req.body;
    User.findByIdAndUpdate(id,{$set:body},function(err,result){
        if(err)return next(err);
        if(result)
        res.redirect('/admin/clients');        
    });
});
router.get('/clients/delete/:id',FX.adminAuth,function(req,res,next){
	User.findByIdAndUpdate(req.params.id,{$set:{isArchive:true}},function(err,result){
		if(err)return next(err);
		if(result)
		res.status(200).json({message:`client deleted`});
	});
});


module.exports = router;
