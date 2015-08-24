/**
 * Created by VinceZK on 3/22/15.
 */
module.exports = {
    /**
     * Get client IP address
     * @param req
     * @returns {*|MockRequest.socket.remoteAddress|remoteAddress}
     */
    getClientIp:function(req) {
        return req.headers['x-forwarded-for'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            req.connection.socket.remoteAddress;
    }
};