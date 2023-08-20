const express = require('express');
const { Types: { ObjectId } } = require('mongoose');

const FX = require('../../utils/functions');
const { snsUserTopic, snsBusinessTopic } = require('../../config/constants');

const router = express.Router();

router.get('/notifications',FX.adminAuth,(req,res)=>res.render('notification.html'));

router.post('/notifications/find',FX.adminAuth,(req, res, next)=>{
    var {length,start}=req.body;
    var sort={};
    sort_arr=["_id","created","type","message"];
    query={isArchive:false,sender:req.session.user._id}

    var sort_key=sort_arr[req.body["order[0][column]"]*1];
    var sort_val=req.body["order[0][dir]"]=="asc"?1:-1;
    sort[sort_key]=sort_val;
    //console.log("sort======>",sort);
    var limit=length*1>0?length*1:'';

    Notification.count(query)
    .exec((err,result1)=>{
        if(err)return next(err);
        Notification.find(query,'created type message')
        .sort(sort)
        .skip(start*1)
        .limit(limit)
        .exec((err,result)=>{
            if(err)return next(err);
            res.json({recordsFiltered:result1,recordsTotal:result.length,data:result});
        });
    });
});


router.post('/notifications/send/',FX.adminAuth,(req, res, next)=>{
    let {receiverType,description}=req.body;

    let notification={
        sender:req.session.user._id,
        message:description,
        type:receiverType,
    };

    let data={
        os:'android',
        message:description,
        type:'broadcast'
    };
    Notification.create(notification,(err)=>{
        if(err)return next(err);

        let query={isArchive:false};

        if(receiverType === 'user') 
            query.isBusiness=false;

        if(receiverType === 'businessUser')
            query.isBusiness=true;
        
        User.updateMany(query,{$inc:{unreadCount:1}},(err,result)=>{
            if(err)return next(err);
            //console.log("result======>",result);
            if(receiverType === "all")
            {
                FX.send_push_notification(data,snsBusinessTopic,(err)=>{
                    if(err)return next(err); 
                });

                FX.send_push_notification(data,snsUserTopic,(err)=>{
                    if(err)return next(err); 
                });
                res.redirect('/admin/notifications');
                // res.redirect('/admin');
            }
            else
            {
                let topic=(receiverType === "businessUser") ? snsBusinessTopic : snsUserTopic;
                FX.send_push_notification(data,topic,(err)=>{
                    if(err)return next(err); 
                    res.redirect('/admin/notifications');
                    // res.redirect('/admin');
                });
            }
        });
    });
});

router.get('/notifications/delete/:id',FX.adminAuth,function(req,res,next){
    Notification.updateOne({_id:ObjectId(req.params.id)},{$set:{isArchive:true}},function(err,result){
        if(err)return next(err);
            
        if(result)
        res.status(200).json({message:`notification deleted`});
    });
});

module.exports = router;