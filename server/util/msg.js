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
    {msgCat:'snapshot',
    msgItems: [
        {msgName:'SQL_ERROR', msgType:'E', msgText:'数据库错误：%s。'},
        {msgName:'PHANTOM_RENDER_ERROR', msgType:'E', msgText:'网页转换时发生错误，可能是该网页无法访问。%s'},
        {msgName:'ALY_OSS_UPLOAD_ERROR', msgType:'E', msgText:'上传内容的时候发生错误。%s'},
        {msgName:'ALY_OSS_DELETE_OBJECT_ERROR', msgType:'E', msgText:'删除内容的时候发生错误。'},
        {msgName:'SUBMIT_BATCH_JOB_FAIL', msgType:'E', msgText:'快照作业提交失败，请联系网站管理员！'},
        {msgName:'SUBMIT_BATCH_JOB_SUCCESS', msgType:'S', msgText:'快照作业已成功提交，请耐心等待几分钟!'},
        {msgName:'UPDATE_BATCH_JOB_FAIL', msgType:'S', msgText:'快照作业更新失败，请联系网站管理员！'},
        {msgName:'UPDATE_BATCH_JOB_SUCCESS', msgType:'S', msgText:'快照作业更新成功！'},
        {msgName:'ADD_EMAIL_FAIL', msgType:'E', msgText:'Email保存失败，请联系管理员！'},
        {msgName:'ADD_EMAIL_SUCCESS', msgType:'S', msgText:'Email保存成功，作业完成后将自动发送邮件通知你！'},
        {msgName:'SNAPSHOT_NON_EXIST', msgType:'E', msgText:'你访问的快照不存在！'}
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