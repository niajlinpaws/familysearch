const express = require('express');
const { Types: { ObjectId } } = require('mongoose');
const FX = require('../../utils/functions');

const router = express.Router();
const csv = {};

router.get('/brands/csv',FX.adminAuth,(req,res,next)=>{
	User.find({isArchive:false},{_id:0,firstName:1,email:1,countryCode:1,mobile:1,location:1,website:1,description:1,created:1},(err,result)=>{
		if(err)return next(err);
		let columns={firstName:"Business Name",description:"Description",email:"Email",countryCode:"Country Code",mobile:"Mobile Number",
		location:"Location",website:"Website",created:"Created At"};

		csv.stringify(result,{header:true,columns:columns},(err,output)=>{
			res.json(output);
		});
	});
});

router.get('/brands',FX.adminAuth, (req, res, next)=>res.render('brand.html'));

router.post('/brands/find',FX.adminAuth,(req,res,next)=>{
	var {length,start}=req.body;
	var sort={};

    search_arr=["name"];
    sort_arr=["_id","name","qty"];
    query={
        isArchive:false
    };

	var sort_key=sort_arr[parseInt(req.body["order[0][column]"])];
	var sort_val=req.body["order[0][dir]"]=="asc"?1:-1;
	sort[sort_key]=sort_val;
	var limit=parseInt(length)>0?parseInt(length):'';

	if(req.body['search[value]'])
	{
		query["$or"]=[];
		search_arr.forEach(function(field){
			var obj={};
			obj[field] =
			{
		        '$regex': req.body['search[value]'],
		        '$options': 'i'
		    } 
			query["$or"].push(obj);
		});
	}

	Brand.count(query)
	.exec((err,result1)=>{
		if(err)return next(err);
		Brand.find(query)
		.sort(sort)
		.skip(parseInt(start))
		.limit(limit)
		.exec((err,result)=>{
			if(err)return next(err);
			res.json({recordsFiltered:result1,recordsTotal:result.length,data:result});
		});
	});

});


router.post('/brands/add',FX.adminAuth,function(req,res,next){
	var body=req.body;

	Brand.create(body,(err, user)=> {
		if(err)return next(err);
		return res.redirect('/admin/brands');	
	});
});

router.post('/brands/edit',FX.adminAuth,function(req,res,next){
	var body=req.body
	
	Brand.findByIdAndUpdate(body.id,body,function(err,result){
		if(err)return next(err);
		return res.redirect('/admin/brands');
	});
});

router.get('/brands/delete/:id',FX.adminAuth,function(req,res,next){
	Brand.findByIdAndUpdate(req.params.id,{$set:{isArchive:true}},function(err,result){
		if(err)return next(err);
        if(result)
        Product.updateMany({brand:ObjectId(req.params.id)},{$set:{isArchive:true}},(err,result)=>{
            if(err) return next(err);
            res.status(200).json({message:`brand deleted`});
        });
	});
});

router.post('/brands/styles/find',FX.adminAuth,(req,res,next)=>{
	var {length,start}=req.body;
	var sort={};

    search_arr=["styleCode"];
    sort_arr=["_id","styleCode"];
    query={
        isArchive:false
    };

	var sort_key=sort_arr[parseInt(req.body["order[0][column]"])];
	var sort_val=req.body["order[0][dir]"]=="asc"?1:-1;
	sort[sort_key]=sort_val;
	var limit=parseInt(length)>0?parseInt(length):'';

	if(req.body['search[value]'])
	{
		query["$or"]=[];
		search_arr.forEach(function(field){
			var obj={};
			obj[field] =
			{
		        '$regex': req.body['search[value]'],
		        '$options': 'i'
		    } 
			query["$or"].push(obj);
		});
	}

	var match={
		$match:{
			...query,
			brand:ObjectId(req.query.brand)
		}
	};

	var group = {
		$group:{
			_id:"$styleCode",
			qty:{
				$sum: 1
			}
		}	
	};

	Product.aggregate([
		match,
		group
	],(err,result1)=>{
		if(err)return next(err);
		Product.aggregate([
			match,
			group,
			{
				$sort:sort
			},
			{
				$skip:start*1
			},
			{
				$limit:limit
			}
		],(err,result)=>{
			if(err)return next(err);
			res.json({recordsFiltered:result1.length,recordsTotal:result.length,data:result});
		});
	});

});

router.get('/brands/styles/sizes',FX.adminAuth,(req,res,next)=>{
	var {brand,styleCode}=req.query;
	
	var match={
		$match:{
			isArchive:false,
			styleCode,
			brand:ObjectId(brand)
		}
	};

	var group = {
		$group:{
			_id:"$size",
			qty:{
				$sum: 1
			}
		}	
	};

	Product.aggregate([
		match,
		group,
	],(err,result)=>{
		if(err)return next(err);
		res.json({ result });
	});

});

module.exports = router;