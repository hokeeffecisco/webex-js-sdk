/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */


const bodyParser = require(`body-parser`);
const express = require(`express`);
const reflect = require(`./reflect`);

/* eslint new-cap: [0] */
const router = express.Router();

// Configure JSON processing
// -------------------------

router.use(bodyParser.json());

router.get(`/get`, (req, res) => {
  res.send({
    isObject: true
  });
});

router.patch(`/set`, reflect);
router.post(`/set`, reflect);
router.put(`/set`, reflect);

module.exports = router;
