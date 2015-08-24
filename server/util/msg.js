/**
 * Created by VinceZK on 10/25/14.
 * Used to process business or UI level message
 * msgCat: message category
 * msgName: message short name
 * msgType: 'S'=Succeeded, 'W'=Warning, 'E'=Error, 'I'=Information, 'U'=Undefined
 * msgText: human readable message text
 * arg1~argn: message arguments used to replace the placeholders in msgText
 */
var _ = require('underscore');
var msgTypePattern = 'SWEIU';

//TODO:Predefined system messages should be moved outside!
var messages = [
    {msgCat:'GEN',
     msgItems: [
     {msgName:'001', msgType:'U', msgText:'%s %s %s %s'},
     {msgName:'ID_NOT_EXIST', msgType:'E', msgText:'The unique attribute: %s is invalid!'},
     {msgName:'KEY_NOT_EXIST', msgType:'E', msgText:'The key: %s is not exist!'},
     {msgName:'REC_GUID_NOT_EXIST', msgType:'E', msgText:'The REC_GUID: %s is not exist!'},
     {msgName:'SOFT_DELETE_SUCCESS', msgType:'S', msgText:'The object: %s is deleted!'},
     {msgName:'SOFT_DELETE_FAIL', msgType:'E', msgText:'The deletion operation fail!'},
     {msgName:'RESTORE_SUCCESS', msgType:'S', msgText:'The object: %s is restored!'},
     {msgName:'RESTORE_FAIL', msgType:'E', msgText:'The restore operation fail!'},
     {msgName:'HARD_DELETE_SUCCESS', msgType:'S', msgText:'The object: %s is permanently deleted!'},
     {msgName:'HARD_DELETE_FAIL', msgType:'E', msgText:'The deletion operation fail!'},
     {msgName:'REQUIRE_SOFT_DELETE', msgType:'E', msgText:'You need first soft delete the object: %s!'},
     {msgName:'UNIQUE_ATTRIBUTE_LIMIT', msgType:'E', msgText:'Unique attributes cannot be updated!'},
     {msgName:'ATTRIBUTE_NOT_EXIST', msgType:'E', msgText:"Entity: %s doesn't have the attribute: %s"},
     {msgName:'UNIQUE_IDX_NOT_EXIST', msgType:'E', msgText:"Unique index table of attribute: %s does not exist!"}
     ]},

    {msgCat:'user',
     msgItems: [
     {msgName:'USER_CREATION_FAIL', msgType:'E', msgText:'Error: user: %s failed to be created!'},
     {msgName:'USER_CREATION_SUCCESS', msgType:'S', msgText:'User: %s is created!'},
     {msgName:'USER_NOT_EXIST', msgType:'E', msgText:'User: %s is not exist!'},
     {msgName:'USER_GET_SUCCESS', msgType:'S', msgText:'User: %s is returned!'},
     {msgName:'USER_PWD_CHANGE_FAIL', msgType:'E', msgText:'Password change failed!'},
     {msgName:'USER_PWD_CHANGE_SUCCESS', msgType:'S', msgText:'Password change succeed!'}
    ]},

    {msgCat:'blog',
     msgItems: [
     {msgName:'BLOG_CREATION_FAIL', msgType:'E', msgText:'Error: blog: %s failed to be created!'},
     {msgName:'BLOG_CREATION_SUCCESS', msgType:'S', msgText:'Blog: %s is created!'},
     {msgName:'BLOG_NOT_EXIST', msgType:'E', msgText:'Blog: %s is not exist!'},
     {msgName:'BLOG_GET_SUCCESS', msgType:'S', msgText:'Blog: %s is returned!'},
     {msgName:'BLOG_UPDATE_ERR', msgType:'E', msgText:'Error occurs when updating blog: %s!'},
     {msgName:'BLOG_UPDATE_SUCCESS', msgType:'S', msgText:'Blog is updated!'}
    ]},

    {msgCat:'blog_c',
    msgItems: [
        {msgName:'ADD_BLOG_COMMENT_FAIL', msgType:'E', msgText:'Add comment failed!'},
        {msgName:'ADD_BLOG_COMMENT_SUCCESS', msgType:'S', msgText:'Your comment is post!'},
        {msgName:'BLOG_COMMENT_DELETE_FAIL', msgType:'E', msgText:'Your comment is NOT deleted!'},
        {msgName:'BLOG_COMMENT_DELETE_SUCCESS', msgType:'S', msgText:'Your comment is deleted!'},
        {msgName:'BLOG_COMMENT_NOT_EXIST', msgType:'E', msgText:'Blog comment %s is not exist!'},
        {msgName:'BLOG_COMMENT_GROUP_SUCCESS', msgType:'S', msgText:'Number of blog comment group list get successful!'},
        {msgName:'GET_BLOG_COMMENT_SUCCESS', msgType:'S', msgText:'Get comments successfully!'}
    ]},

    {msgCat:'snapshot',
    msgItems: [
        {msgName:'PHANTOM_RENDER_ERROR', msgType:'E', msgText:'网页转换时发生错误，可能是该网页无法访问。%s'},
        {msgName:'ALY_OSS_UPLOAD_ERROR', msgType:'E', msgText:'上传内容的时候发生错误。%s'},
        {msgName:'ALY_OSS_DELETE_OBJECT_ERROR', msgType:'E', msgText:'删除内容的时候发生错误。'},
        {msgName:'SUBMIT_BATCH_JOB_FAIL', msgType:'E', msgText:'快照作业提交失败，请联系网站管理员！'},
        {msgName:'SUBMIT_BATCH_JOB_SUCCESS', msgType:'S', msgText:'快照作业已成功提交，请耐心等待几分钟!'},
        {msgName:'UPDATE_BATCH_JOB_FAIL', msgType:'S', msgText:'快照作业更新失败，请联系网站管理员！'},
        {msgName:'UPDATE_BATCH_JOB_SUCCESS', msgType:'S', msgText:'快照作业更新成功！'},
        {msgName:'ADD_EMAIL_FAIL', msgType:'E', msgText:'Email保存失败，请联系管理员！'},
        {msgName:'ADD_EMAIL_SUCCESS', msgType:'S', msgText:'Email保存成功，作业完成后将自动发送邮件通知你！'}
    ]}
];

module.exports = Msg;
function Msg(msgCat){
    this.msgCat = msgCat;
    if(this.msgCat){
        this.msgContainer = _.find(messages,function(msg){
            return msg.msgCat === msgCat;
        })
    }else{
        this.msgContainer = messages[0].msgItems;
    }
}

Msg.prototype.reportMsg = function reportMsg(msgName,msgType){
    var msgItems = this.msgContainer.msgItems;
    var msgItem = _.clone(_.find(msgItems, function(msgItem) {
        return msgItem.msgName === msgName;
    }));
    if(msgItem === undefined){
        msgItem = _.clone(_.find(messages[0].msgItems, function(msgItem) {
            return msgItem.msgName === msgName;
        }));
        if(msgItem === undefined)
            msgItem = messages[0].msgItems[0];
    }
    if(msgType){
        var n = msgTypePattern.search(msgType);
        if(n != -1){
            msgItem.msgType = msgType;
        }
    }
    var args = arguments;
    var i = 1;
    msgItem.msgText = msgItem.msgText.replace(/%s/g, function() {
        i++;
        return ((args[i] === undefined)? '':args[i]);
    });
    return msgItem;
};