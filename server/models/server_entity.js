/**
 * Created by VinceZK on 10/25/14.
 */
'use strict';
var debug = require('debug')('html2pdf:server_entity');
var _ = require('underscore');
var guid = require('../util/guid.js');
var entityDB = require('./connections/conn_mysql_mdb.js');
var async = require('async');
var timeUtil = require('../util/date_time.js');

module.exports = Entity;

function Entity(entityId) {
    this.entityId = entityId;
    this.entityMeta = _.find(entityDB.entities,function(entity) {
        return entity['ENTITY_ID'] === entityId;
    });
    if (this.entityMeta === undefined){
        debug("Error occurs in server_entity: \n" +
              "The entity meta of %s is not exist in tenant %s\n", this.entityId,entityDB.getTenantDomain());
        return;
    }

    //Get searchable attributes and their index tables
    var idxTableName;
    var uIdxAttributes = [];
    var nIdxAttributes = [];
    _.each(_.where(this.entityMeta.ATTRIBUTES,{SEARCHABLE: 1, UNIQUE:1}), function(sAttr){
        idxTableName = "UIX_" + sAttr['ATTR_GUID'];
        uIdxAttributes.push({ATTR_NAME:sAttr.ATTR_NAME, IDX_TABLE:idxTableName, AUTO_INCREMENT:sAttr.AUTO_INCREMENT})
    });
    _.each(_.where(this.entityMeta.ATTRIBUTES,{SEARCHABLE: 1, UNIQUE:0}), function(sAttr){
        idxTableName = "NIX_" + sAttr['ATTR_GUID'];
        nIdxAttributes.push({ATTR_NAME:sAttr.ATTR_NAME, IDX_TABLE:idxTableName})
    });

    this.uIdxAttrs = uIdxAttributes;
    this.nIdxAttrs = nIdxAttributes;
}

/**
 * Return a entityDB reference
 * @returns {*|exports}
 */
Entity.getEntityDB = function(){
    return entityDB;
};

/**
 * save the entity JSON object in mysql DB
 * @param instance = JSON object
 * @param callback(err, results,recGuid)
 */
Entity.prototype.createObject = function createObject(instance,callback){
    var recGuid = guid.genTimeBased();
    var insertSQLs = [];
    var attrValue;
    var entityId = this.entityId;
    var uIdxAttrs = this.uIdxAttrs;
    var nIdxAttrs = this.nIdxAttrs;
    var attributes = this.entityMeta.ATTRIBUTES;
    var relationships = this.entityMeta.RELATIONSHIPS;
    var tenantDomain = this.entityMeta.TENANT_DOMAIN;

    //Insert entity
    var insertSQL = "INSERT INTO ENTITY_INSTANCES VALUES ("
        + entityDB.pool.escape(entityDB.getTenantDomain())
        + "," + entityDB.pool.escape(entityId) + ","
        + entityDB.pool.escape(recGuid)
        + ", 0 ,"
        + "'1')";
    insertSQLs.push(insertSQL);

    //Insert unique indices
    _.each(uIdxAttrs,function(sAttr){
        attrValue = instance[sAttr.ATTR_NAME];
        if(attrValue){
            insertSQL = "INSERT INTO " + sAttr.IDX_TABLE + " (`VALUE0`, `REC_GUID`) VALUES ("
                + entityDB.pool.escape(attrValue) + ","  + entityDB.pool.escape(recGuid) + ")";
            insertSQLs.push(insertSQL);
        }
    });

    //Insert non-unique indices
    _.each(nIdxAttrs,function(sAttr){
        attrValue = instance[sAttr.ATTR_NAME];
        if(attrValue){
            insertSQL = "INSERT INTO " + sAttr.IDX_TABLE + " (`VALUE0`, `REC_GUID`) VALUES ("
                + entityDB.pool.escape(attrValue) + ","  + entityDB.pool.escape(recGuid) + ")";
            insertSQLs.push(insertSQL);
        }
    });

    //Insert relationships
    if (instance['parentRelationship'] === undefined ||
        instance['parentRelationship'] === null ||
        instance['parentRelationship'] === '') {
        if(_.where(relationships,{TYPE:1,REC_MAPPING:2}).length !== 0){
            return callback("ENTITY_DEPENDS_ON_OTHERS");
        }
    }else{
        //console.log(instance.parentRelationship.);
        insertSQL = "INSERT INTO MDB.RELATIONSHIP_INSTANCES (TENANT_DOMAIN, RELATIONSHIP_ID, " +
            "ENTITY1_REC_GUID, ENTITY2_REC_GUID, VALID_FROM, VALID_TO) " +
            "VALUES (" + entityDB.pool.escape(tenantDomain) + "," +
            entityDB.pool.escape(instance['parentRelationship'].relationship.RELATIONSHIP_ID) + "," +
            entityDB.pool.escape(instance['parentRelationship'].parentGuid) + "," +
            entityDB.pool.escape(recGuid) + "," +
            entityDB.pool.escape(timeUtil.getCurrentDateTime()) + "," +
            entityDB.pool.escape(timeUtil.getFutureDateTime(instance['parentRelationship'].relationship.VALID_PERIOD))
            + ")";
        insertSQLs.push(insertSQL);
    }

    //Insert attributes
    _.each(attributes, function(attribute){
        attrValue = instance[attribute.ATTR_NAME];
        if(attrValue){
            insertSQL = "INSERT INTO VALUE (REC_GUID, ATTR_GUID, VAL_ID, VALUE0, VERSION_NO, CHANGE_NO) VALUES ("
                + entityDB.pool.escape(recGuid) + ","
                + entityDB.pool.escape(attribute['ATTR_GUID']) + ","
                + "'0'," //To-Do: Multi Value is not considered yet
                + entityDB.pool.escape(attrValue) + ","
                + "'0', '1')";
            insertSQLs.push(insertSQL);
        }
    });

    //Run all insert SQLs parallel
    entityDB.doUpdatesParallel(insertSQLs,  function(err,results){
        if(err){
            debug("Error occurs in createEntity() when doing parallel updates.\n" +
                "Error info: %s \n" +
                "SQL statements: %s \n", err,insertSQLs);
            callback(err,results,recGuid);
        }else{
            callback(null,results,recGuid);
        }
    });
};

/**
 * Check whether the recGuid is valid
 * @param recGuid
 * @param callback(err, parentRelationship)
 */
Entity.prototype.checkParentRecGuid = function checkParentRecGuid(recGuid, callback){
    var relationships = this.entityMeta.RELATIONSHIPS;
    var relationship;
    var selectSQL = "select * from ENTITY_INSTANCES" +
        " where REC_GUID = " + entityDB.pool.escape(recGuid);

    entityDB.executeSQL(selectSQL, function(err, rows){
        if(err)
            return callback(err);

        if(rows.length === 1 && rows[0].DEL === 0){
            relationship = _.where(relationships,{C_INVOLVES_ID:rows[0].ENTITY_ID,TYPE:1,REC_MAPPING:2});
            if(relationship === undefined){
                return callback("PARENT_REC_GUID_INVALID");
            }
            var parentRelationship = {
                parentGuid: rows[0].REC_GUID,
                relationship:relationship[0]
            };
            return callback(null,parentRelationship);
        }else{
            return callback("PARENT_REC_GUID_NOT_EXIST");
        }
    });
};

/**
 * save the entity JSON object in mysql DB and return an auto-incremental objectID
 * @param instance = JSON object
 * @param callback(err, results, recGuid)
 */
Entity.prototype.createObjectWithReturnId = function createObjectWithReturnId(instance,callback){
    var recGuid = guid.genTimeBased();
    var uIdxAttributes = this.uIdxAttrs;
    var nIdxAttributes = this.nIdxAttrs;
    var entityId = this.entityId;
    var entityAttributes = this.entityMeta.ATTRIBUTES;
    var insertSQLs = [];
    var attrValue;
    var insertSQL;
    var retIdAttr;

    var retIdAttributes = _.where(uIdxAttributes,{AUTO_INCREMENT:1});
    if(retIdAttributes.length === 0){//There is no return-id attribute,use createObject method instead.
        return callback('NO_RETURN_ID_ATTRIBUTE');
    }

    _.each(retIdAttributes, function(sAttr){
        insertSQL = "INSERT INTO " + sAttr.IDX_TABLE + " (`REC_GUID`) VALUES ("
            + entityDB.pool.escape(recGuid) + ")";
        insertSQLs.push(insertSQL);
    });

    entityDB.doUpdatesSeries(insertSQLs, function(err,results) {
        if (err) {
            debug("Error occurs in createObjectWithReturnId() when executing series updates.\n" +
                "Error info: %s \n" +
                "SQL statements: %s\n", err, insertSQLs);
            return callback(err);
        }

        for(var i in results)retIdAttributes[i]['RETURN_ID'] = results[i].insertId;

        insertSQLs = [];
        insertSQL = "INSERT INTO ENTITY_INSTANCES VALUES ("
            + entityDB.pool.escape(entityDB.getTenantDomain())
            + "," + entityDB.pool.escape(entityId) + ","
            + entityDB.pool.escape(recGuid)
            + ", 0 ,"
            + "'1')";
        insertSQLs.push(insertSQL);

        _.each(uIdxAttributes,function(sAttr){
            attrValue = instance[sAttr.ATTR_NAME];
            if(sAttr.AUTO_INCREMENT === 0 && attrValue){
                insertSQL = "INSERT INTO " + sAttr.IDX_TABLE + " (`VALUE0`, `REC_GUID`) VALUES ("
                    + entityDB.pool.escape(attrValue) + ","  + entityDB.pool.escape(recGuid) + ")";
                insertSQLs.push(insertSQL);
            }
        });

        _.each(nIdxAttributes,function(sAttr){
            attrValue = instance[sAttr.ATTR_NAME];
            if(attrValue){
                insertSQL = "INSERT INTO " + sAttr.IDX_TABLE + " (`VALUE0`, `REC_GUID`) VALUES ("
                    + entityDB.pool.escape(attrValue) + ","  + entityDB.pool.escape(recGuid) + ")";
                insertSQLs.push(insertSQL);
            }
        });

        _.each(entityAttributes, function(attribute){
            if(attribute.AUTO_INCREMENT === 1){
                retIdAttr = _.find(retIdAttributes,function(ret){
                    return ret.ATTR_NAME === attribute.ATTR_NAME;
                });
                insertSQL = "INSERT INTO VALUE (REC_GUID, ATTR_GUID, VAL_ID, VALUE0, VERSION_NO, CHANGE_NO) VALUES ("
                    + entityDB.pool.escape(recGuid) + ","
                    + entityDB.pool.escape(attribute['ATTR_GUID']) + ","
                    + "'0'," //To-Do: Multi Value is not considered yet
                    + entityDB.pool.escape(retIdAttr['RETURN_ID']) + ","
                    + "'0', '1')";
                insertSQLs.push(insertSQL);
            }else{
                attrValue = instance[attribute.ATTR_NAME];
                if(attrValue){
                    insertSQL = "INSERT INTO VALUE (REC_GUID, ATTR_GUID, VAL_ID, VALUE0, VERSION_NO, CHANGE_NO) VALUES ("
                        + entityDB.pool.escape(recGuid) + ","
                        + entityDB.pool.escape(attribute['ATTR_GUID']) + ","
                        + "'0'," //To-Do: Multi Value is not considered yet
                        + entityDB.pool.escape(attrValue) + ","
                        + "'0', '1')";
                    insertSQLs.push(insertSQL);
                }
            }
        });

        entityDB.doUpdatesParallel(insertSQLs,  function(err,results){
            if(err){
                debug("Error occurs in createEntity() when doing parallel updates.\n" +
                    "Error info: %s \n" +
                    "SQL statements: %s \n", err,insertSQLs);
                callback(err, results,recGuid);
            }else{
                callback(null, retIdAttributes,recGuid);
            }
        });
    });
};

/**
 * Soft delete an entity instance by set the DEL flag to 1
 * @param idAttr = {OBJECT_ID:ID_VALUE}
 * for example: {USER_ID: "JACK"}
 * @param callback(err, retCode)
 * retCode === -1: the unique attribute OBJECT_ID is not exist
 * retCode === 0: no object is updated, possibly the object ID is not exist
 * retCode === 1: the corresponding object is updated
 */
Entity.prototype.softDeleteById = function softDeleteById(idAttr,callback){
    var idAttrMeta = _.find(this.uIdxAttrs, function (sAttr) {
        return sAttr.ATTR_NAME === _.keys(idAttr)[0];
    });
    if(idAttrMeta === undefined){
      return callback(null, -1);
    }
    var updateSQL = "UPDATE ENTITY_INSTANCES SET DEL = 1 WHERE TENANT_DOMAIN = "
        + entityDB.pool.escape(entityDB.getTenantDomain())
        + " AND ENTITY_ID = "+ entityDB.pool.escape(this.entityId) +" AND REC_GUID = "
        + "(SELECT REC_GUID FROM " + idAttrMeta.IDX_TABLE
        + " WHERE VALUE0 = " + entityDB.pool.escape(_.values(idAttr)[0]) + ")";
    entityDB.doUpdatesParallel([updateSQL], function(err,results){
        if(err){
            debug("Error occurs in softDelete() when doing parallel updates. \n" +
                "Error info: %s\n" +
                "SQL statement: %s\n", err, updateSQL);
            return callback(err);
        }
        var retCode = results[0].changedRows;
        callback(null,retCode);
    })
};
/**
 * Soft delete an entity instance by set the DEL flag to 1 through internal GUID
 * @param recGuid
 * @param callback(err, retCode)
 * retCode === 0: no object is updated, possibly the object ID is not exist
 * retCode === 1: the corresponding object is updated
 */
Entity.prototype.softDeleteByGuid = function softDeleteByGuid(recGuid,callback){
    var updateSQL = "UPDATE ENTITY_INSTANCES SET DEL = 1 WHERE TENANT_DOMAIN = "
        + entityDB.pool.escape(entityDB.getTenantDomain())
        + " AND ENTITY_ID = "+ entityDB.pool.escape(this.entityId)
        + " AND REC_GUID = " + entityDB.pool.escape(recGuid);

    entityDB.doUpdatesParallel([updateSQL], function(err,results){
        if(err){
            debug("Error occurs in softDeleteByGuid() when doing parallel updates. \n" +
                "Error info: %s\n" +
                "SQL statement: %s\n", err, updateSQL);
            return callback(err);
        }
        var retCode = results[0].changedRows;
        callback(null,retCode);
    })
};

/**
 * Restore the soft deleted blog, set DEL flag = 0
 * @param idAttr = {OBJECT_ID:ID_VALUE}
 * for example: {USER_ID: "JACK"}
 * @param callback(err, retCode)
 * retCode === -1: the unique attribute OBJECT_ID is not exist
 * retCode === 0: no user is updated, possibly the userId is not exist
 * retCode === 1: the corresponding user is restored
 */
Entity.prototype.restoreObjectById = function restoreObject(idAttr,callback){
    var idAttrMeta = _.find(this.uIdxAttrs, function (sAttr) {
        return sAttr.ATTR_NAME === _.keys(idAttr)[0];
    });
    if(idAttrMeta === undefined){
        return callback(null, -1);
    }
    var updateSQL = "UPDATE ENTITY_INSTANCES SET DEL = 0 WHERE TENANT_DOMAIN = "
        + entityDB.pool.escape(entityDB.getTenantDomain())
        + " AND ENTITY_ID = "+ entityDB.pool.escape(this.entityId) +" AND REC_GUID = "
        + "(SELECT REC_GUID FROM " + idAttrMeta.IDX_TABLE
        + " WHERE VALUE0 = " + entityDB.pool.escape(_.values(idAttr)[0]) + ")";
    entityDB.doUpdatesParallel([updateSQL], function(err,results){
        if(err){
            debug("Error occurs in restoreObject() when doing parallel updates.\n" +
                  "Error info: %s\n" +
                  "SQL statement: %s\n", err,  updateSQL);
            return callback(err);
        }
        var retCode = results[0].changedRows;
        callback(null,retCode);
    })
};

/**
 * Restore the soft deleted blog, set DEL flag = 0
 * @param recGuid
 * @param callback(err, retCode)
 * retCode === 0: no user is updated, possibly the userId is not exist
 * retCode === 1: the corresponding user is restored
 */
Entity.prototype.restoreObjectByGuid = function restoreObjectByGuid(recGuid,callback){
    var updateSQL = "UPDATE ENTITY_INSTANCES SET DEL = 0 WHERE TENANT_DOMAIN = "
        + entityDB.pool.escape(entityDB.getTenantDomain())
        + " AND ENTITY_ID = "+ entityDB.pool.escape(this.entityId)
        + " AND REC_GUID = " + entityDB.pool.escape(recGuid);
    entityDB.doUpdatesParallel([updateSQL], function(err,results){
        if(err){
            debug("Error occurs in restoreObjectByGuid() when doing parallel updates.\n" +
                "Error info: %s\n" +
                "SQL statement: %s\n", err,  updateSQL);
            return callback(err);
        }
        var retCode = results[0].changedRows;
        callback(null,retCode);
    })
};

/**
 * Delete the object from the DB
 * @param idAttr = {OBJECT_ID:ID_VALUE}
 * for example: {USER_ID: "JACK"}
 * @param callback(err, retCode)
 * retCode === -2: Need soft deletion first
 * retCode === -1: the unique attribute OBJECT_ID is not exist
 * retCode === 0: no object is deleted, possibly the objectId is not exist
 * retCode === 1: the corresponding object is deleted
 */
Entity.prototype.hardDeleteById = function hardDeleteById(idAttr,callback){
    var uIdxAttrs = this.uIdxAttrs;
    var idAttrMeta = _.find(uIdxAttrs, function (sAttr) {
        return sAttr.ATTR_NAME === _.keys(idAttr)[0];
    });
    if(idAttrMeta === undefined){
        return callback(null, -1);
    }

    var selectSQL = "SELECT REC_GUID, DEL FROM ENTITY_INSTANCES WHERE TENANT_DOMAIN = "
        + entityDB.pool.escape(entityDB.getTenantDomain())
        + " AND ENTITY_ID = "+ entityDB.pool.escape(this.entityId)
        + " AND REC_GUID = (SELECT REC_GUID FROM " + idAttrMeta.IDX_TABLE
        + " WHERE VALUE0 = " + entityDB.pool.escape(_.values(idAttr)[0]) + ")";
    this.deleteObject(selectSQL,callback);
};

/**
 * Delete the object from the DB by GUID
 * @param recGuid
 * for example: {USER_ID: "JACK"}
 * @param callback(err, retCode)
 * retCode === -2: Need soft deletion first
 * retCode === 0: no object is deleted, possibly the objectId is not exist
 * retCode === 1: the corresponding object is deleted
 */
Entity.prototype.hardDeleteByGuid = function hardDeleteByGuid(recGuid,callback){

    var selectSQL = "SELECT REC_GUID, DEL FROM ENTITY_INSTANCES WHERE TENANT_DOMAIN = "
        + entityDB.pool.escape(entityDB.getTenantDomain())
        + " AND ENTITY_ID = "+ entityDB.pool.escape(this.entityId)
        + " AND REC_GUID = " + entityDB.pool.escape(recGuid);

    this.deleteObject(selectSQL,callback);
};

/**
 * Internal USE:
 * Delete an object through a SQL which is used to get an entry from table ENTITY_INSTANCES
 * @param selectSQL
 * @param callback
 */
Entity.prototype.deleteObject = function deleteObject(selectSQL,callback){
    var uIdxAttrs = this.uIdxAttrs;
    var nIdxAttrs = this.nIdxAttrs;
    var entityId = this.entityId;
    var retCode;
    entityDB.executeSQL(selectSQL, function(err, rows){
        if(err){
            debug("Error occurs in hardDelete() when executing select SQL.\n" +
                "Error info: %s\n" +
                "SQL statement: %s\n",err, selectSQL);
            return callback(err);
        }

        if(rows.length === 0){
            retCode = 0; //The object ID is not exist!
            return callback(null, retCode);
        }

        if(rows[0]['DEL'] !== 1){
            retCode = -2; //Need soft deletion first!
            return callback(null, retCode);
        }

        var REC_GUID = rows[0]['REC_GUID'];
        var deleteSQLs = [];
        var deleteSQL;
        deleteSQL = "DELETE FROM ENTITY_INSTANCES WHERE TENANT_DOMAIN = "
            + entityDB.pool.escape(entityDB.getTenantDomain())
            + " AND ENTITY_ID = " + entityDB.pool.escape(entityId)
            + " AND REC_GUID = " + entityDB.pool.escape(REC_GUID);
        deleteSQLs.push(deleteSQL);

        _.each(uIdxAttrs, function(sAttr) {
            deleteSQL = "DELETE FROM " + sAttr.IDX_TABLE + " WHERE REC_GUID = "
                + entityDB.pool.escape(REC_GUID);
            deleteSQLs.push(deleteSQL);
        });
        _.each(nIdxAttrs, function(sAttr) {
            deleteSQL = "DELETE FROM " + sAttr.IDX_TABLE + " WHERE REC_GUID = "
                + entityDB.pool.escape(REC_GUID);
            deleteSQLs.push(deleteSQL);
        });

        deleteSQL = "DELETE FROM VALUE WHERE REC_GUID = "
            + entityDB.pool.escape(REC_GUID);
        deleteSQLs.push(deleteSQL);

        entityDB.doUpdatesParallel(deleteSQLs, function(err,results){
            if(err){
                debug("Error occurs in hardDeleteUser() when doing parallel updates. \n" +
                    "Error info: %s\n" +
                    "SQL statements: %s\n", err,  deleteSQLs);
                return callback(err);
            }
            retCode = results.length;
            callback(null,retCode);
        })
    })
};

/**
 * Get object in a JSON format from its ID attributes
 * @param idAttr = {OBJECT_ID:ID_VALUE}
 * @param callback(err, instance)
 * err = 'UNIQUE_ATTR_NOT_EXIST' means the ID attribute is not exist
 * instance is a JSON object or NULL if the ID is not exist!
 */
Entity.prototype.getObjectById = function getObjectById(idAttr,callback){
    var idAttrMeta = _.find(this.uIdxAttrs, function (sAttr) {
        return sAttr.ATTR_NAME === _.keys(idAttr)[0];
    });
    if(idAttrMeta === undefined){
        return callback('UNIQUE_ATTR_NOT_EXIST',null);
    }
    var instance = {};
    var selectSQL = "SELECT REC_GUID FROM " + idAttrMeta.IDX_TABLE
                  + " WHERE VALUE0 = " + entityDB.pool.escape(_.values(idAttr)[0]);
    entityDB.executeSQL(selectSQL, function(err, rows){
        if(err)
            return callback(err);

        if (rows.length === 0){
            return callback(null,null);
        }

        instance['REC_GUID'] = rows[0].REC_GUID;
        selectSQL = "SELECT C.ATTR_NAME, A.VALUE0 "
            + "FROM MDB.VALUE as A "
            + "RIGHT JOIN MDB.ATTRIBUTE AS C "
            + "ON A.ATTR_GUID = C.ATTR_GUID "
            + "WHERE A.REC_GUID = " + entityDB.pool.escape(instance.REC_GUID);
        entityDB.executeSQL(selectSQL, function(err, rows){
            if(err)
                return callback(err);

            _.each(rows,  function(attr){
                instance[attr.ATTR_NAME] = attr['VALUE0'];
            });
            callback(null, instance);
        })
    });
};

/**
 * Get object in a JSON format from its ID attributes
 * @param recGuid
 * @param callback(err,instance)
 * instance is a JSON object or NULL if the ID is not exist!
 */
Entity.prototype.getObjectByGuid = function getObjectByGuid(recGuid,callback){
    var selectSQL = "SELECT C.ATTR_NAME, A.VALUE0 "
        + "FROM MDB.VALUE as A "
        + "RIGHT JOIN MDB.ATTRIBUTE AS C "
        + "ON A.ATTR_GUID = C.ATTR_GUID "
        + "WHERE A.REC_GUID = " + entityDB.pool.escape(recGuid);


    entityDB.executeSQL(selectSQL, function(err, rows){
        if(err)
            return callback(err);

        var instance = {};
        _.each(rows,  function(attr){
            instance[attr.ATTR_NAME] = attr['VALUE0'];
        });

        if (_.isEmpty(instance)) {
            callback('REC_GUID_NOT_EXIST',recGuid);
        } else {
            instance['REC_GUID'] = recGuid;
            callback(null,instance);
        }
    })
};

/**
 * update object attributes based on an ID
 * @param idAttr
 * @param changeAttr = {ATTR_NAME1:ATTR_VALUE1, ATTR_NAME2:ATTR_VALUE2, ....}
 * @param callback(err,retCode,key)
 * retCode === -4: Unique attributes can not be updated!
 * retCode === -3: Attribute is not exist for the entity!
 * retCode === -2: The object is soft deleted,so it can not be updated!
 * retCode === -1: The idAttr is not exist!
 * retCode === 0: The object ID is not exist!
 * retCode >= 1: number of attributes are updated!
 * key is the attribute key
 */
Entity.prototype.changeObjectById = function changeObjectById(idAttr,changeAttr,callback){
    var idAttrMeta = _.find(this.uIdxAttrs, function (sAttr) {
        return sAttr.ATTR_NAME === _.keys(idAttr)[0];
    });
    if(idAttrMeta === undefined){
        return callback(null, -1);
    }
    var selectSQL = "SELECT REC_GUID, DEL FROM ENTITY_INSTANCES WHERE TENANT_DOMAIN = "
        + entityDB.pool.escape(entityDB.getTenantDomain())
        + " AND ENTITY_ID = "+ entityDB.pool.escape(this.entityId)
        + " AND REC_GUID = (SELECT REC_GUID FROM " + idAttrMeta.IDX_TABLE
        + " WHERE VALUE0 = " + entityDB.pool.escape(_.values(idAttr)[0]) + ")";

    this.changeObject(selectSQL,changeAttr,callback);
};

/**
 * update object attributes based on an ID
 * @param recGuid
 * @param changeAttr = {ATTR_NAME1:ATTR_VALUE1, ATTR_NAME2:ATTR_VALUE2, ....}
 * @param callback(err,retCode,key)
 * retCode === -4: Unique attributes can not be updated!
 * retCode === -3: Attribute is not exist for the entity!
 * retCode === -2: The object is soft deleted,so it can not be updated!
 * retCode === 0: The object ID is not exist!
 * retCode >= 1: number of attributes are updated!
 * key is the attribute key
 */
Entity.prototype.changeObjectByGuid = function changeObjectByGuid(recGuid,changeAttr,callback){

    var selectSQL = "SELECT REC_GUID, DEL FROM ENTITY_INSTANCES WHERE TENANT_DOMAIN = "
        + entityDB.pool.escape(entityDB.getTenantDomain())
        + " AND ENTITY_ID = "+ entityDB.pool.escape(this.entityId)
        + " AND REC_GUID = "+ entityDB.pool.escape(recGuid);
    this.changeObject(selectSQL,changeAttr,callback);
};

/**
 * Interanl USE!
 * @param selectSQL
 * @param changeAttr
 * @param callback
 */
Entity.prototype.changeObject = function(selectSQL,changeAttr,callback){
    var REC_GUID;
    var retCode;
    var entityMeta = this.entityMeta;
    var uIdxAttributes = this.uIdxAttrs;
    var nIdxAttributes = this.nIdxAttrs;
    var changeAttrMeta;
    var updateSQL;
    var updateSQLs = [];

    entityDB.executeSQL(selectSQL, function(err, rows) {
        if (err) {
            debug("Error occurs in changeObject() when executing select SQL.\n" +
                "Error info: %s\n" +
                "SQL statement: %s\n", err, selectSQL);
            return callback(err);
        }

        if(rows.length === 0){
            retCode = 0; //The object ID is not exist!
            return callback(null, retCode);
        }

        if(rows[0]['DEL'] === 1){
            retCode = -2; //The object is soft deleted!
            return callback(null, retCode);
        }

        REC_GUID = rows[0]['REC_GUID'];

        var uIdxTable;
        var nIdxTable;

        for(var key in changeAttr){
            uIdxTable = _.find(uIdxAttributes,function(sAttr){
                return sAttr.ATTR_NAME === key;
            });
            if(uIdxTable){
                //TODO: currently unique attribute is not allowed to update!
                return callback(null,-4,key);
            }

            changeAttrMeta = _.find(entityMeta.ATTRIBUTES, function(attr){
                return attr.ATTR_NAME === key;
            });
            if(changeAttrMeta === undefined){
                return callback(null,-3,key); //Invalid attribute
            }

            updateSQL = "INSERT INTO VALUE (REC_GUID, ATTR_GUID, VAL_ID, VALUE0, VERSION_NO, CHANGE_NO) VALUES ("
                + entityDB.pool.escape(REC_GUID) + ","
                + entityDB.pool.escape(changeAttrMeta['ATTR_GUID']) + ","
                + "'0'," //To-Do: Multi Value is not considered yet
                + entityDB.pool.escape(changeAttr[key]) + ","
                + "'0', '1') ON DUPLICATE KEY UPDATE VALUE0 = " + entityDB.pool.escape(changeAttr[key]);
            updateSQLs.push(updateSQL);

            nIdxTable = _.find(nIdxAttributes,function(sAttr){
                return sAttr.ATTR_NAME === key;
            });
            if(nIdxTable){
                updateSQL = "INSERT INTO " + nIdxTable.IDX_TABLE + " (`VALUE0`, `REC_GUID`) VALUES ("
                    + entityDB.pool.escape(changeAttr[key]) + ","  + entityDB.pool.escape(REC_GUID)
                    + ") ON DUPLICATE KEY UPDATE VALUE0 = " + entityDB.pool.escape(changeAttr[key]);
                updateSQLs.push(updateSQL);
            }
        }

        entityDB.doUpdatesParallel(updateSQLs, function(err,results){
            if(err){
                debug("Error occurs in changeObject() when doing parallel updates. \n" +
                    "Error info: %s\n" +
                    "SQL statements: %s\n", err,  updateSQLs);
                return callback(err);
            }
            retCode = results.length;
            callback(null,retCode);
        })
    })
};