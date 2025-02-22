/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */


/**
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @returns {undefined}
 */
function reflect(req, res) {
  res.set(`content-type`, req.headers[`content-type`]);
  res.status(200).send(req.body).end();
}

module.exports = reflect;
