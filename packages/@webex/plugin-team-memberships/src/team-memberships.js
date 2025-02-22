/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {WebexPlugin, Page} from '@webex/webex-core';

/**
 * @typedef {Object} TeamMembershipObject
 * @property {string} id - (server generated) Unique identifier for the team membership
 * @property {string} teamId - The team ID
 * @property {string} personId - The person ID
 * @property {string} personEmail - The email address of the person
 * @property {boolean} isModerator - Set to `true` to make the person a team
 * moderator
 * @property {string} created - (server generated) The date and time that the team membership was created
 */

/**
 * Team Memberships represent a person's relationship to a team. Use this API to
 * list members of any team that you're in or create memberships to invite
 * someone to a team. Team memberships can also be updated to make someone a
 * moderator or deleted to remove them from the team.
 *
 * Just like in the Webex app, you must be a member of the team in order to list
 * its memberships or invite people.
 * @class
 */
const TeamMemberships = WebexPlugin.extend({
  /**
   * Add someone to a team by Person ID or email address; optionally making them
   * a moderator.
   * @instance
   * @memberof TeamMemberships
   * @param {TeamMembershipObject} membership
   * @returns {Promise<TeamMembershipObject>}
   * @example
   * webex.teams.create({name: 'Create Team Membership Example'})
   *   .then(function(team) {
   *     return webex.teamMemberships.create({
   *      personEmail: 'alice@example.com',
   *      teamId: team.id
   *    });
   *   })
   *   .then(function(membership) {
   *     var assert = require('assert');
   *     assert(membership.id);
   *     assert(membership.teamId);
   *     assert(membership.personId);
   *     assert(membership.personEmail);
   *     assert('isModerator' in membership);
   *     assert(membership.created);
   *     return 'success';
   *   });
   *   // => success
   */
  create(membership) {
    return this.request({
      method: 'POST',
      service: 'hydra',
      resource: 'team/memberships',
      body: membership
    })
      .then((res) => res.body);
  },

  /**
   * Get details for a membership by ID.
   * @instance
   * @memberof TeamMemberships
   * @param {TeamMembershipObject|string} membership
   * @returns {Promise<TeamMembershipObject>}
   * @example
   * var membership;
   * webex.teams.create({name: 'Get Team Memberships Example'})
   *   .then(function(team) {
   *     return webex.teamMemberships.create({
   *       personEmail: 'alice@example.com',
   *       teamId: team.id
   *     });
   *   })
   *   .then(function(m) {
   *     membership = m;
   *     return webex.teamMemberships.get(m.id);
   *   })
   *   .then(function(m) {
   *     var assert = require('assert');
   *     assert.deepEqual(m, membership);
   *     return 'success';
   *   });
   *   // => success
   */
  get(membership) {
    const id = membership.id || membership;

    return this.request({
      service: 'hydra',
      resource: `team/memberships/${id}`
    })
      .then((res) => res.body.items || res.body);
  },

  /**
   * Lists all team memberships. By default, lists memberships for teams to
   * which the authenticated user belongs.
   * @instance
   * @memberof TeamMemberships
   * @param {Object} options
   * @param {string} options.max
   * @returns {[type]}
   * @example
   * var team;
   * webex.teams.create({name: 'List Team Memberships Example'})
   *   .then(function(t) {
   *     team = t;
   *     return webex.teamMemberships.create({
   *      personEmail: 'alice@example.com',
   *      teamId: team.id
   *     });
   *   })
   *   .then(function() {
   *     return webex.teamMemberships.list({teamId: team.id});
   *   })
   *   .then(function(teamMemberships) {
   *     var assert = require('assert');
   *     assert.equal(teamMemberships.length, 2);
   *     for (var i = 0; i < teamMemberships.length; i+= 1) {
   *       assert.equal(teamMemberships.items[i].teamId, team.id);
   *     }
   *     return 'success';
   *   });
   *   // => success
   */
  list(options) {
    return this.request({
      service: 'hydra',
      resource: 'team/memberships',
      qs: options
    })
      .then((res) => new Page(res, this.webex));
  },

  /**
   * Deletes a membership by ID.
   * @instance
   * @memberof TeamMemberships
   * @param {TeamMembershipObject|string} membership
   * @returns {Promise}
   * @example
   * var membership, team;
   * webex.teams.create({name: 'Remove Team Memberships Example'})
   *   .then(function(t) {
   *     team = t;
   *     return webex.teamMemberships.create({
   *      personEmail: 'alice@example.com',
   *      teamId: team.id
   *     });
   *   })
   *   .then(function(m) {
   *     membership = m;
   *     return webex.teamMemberships.list({teamId: team.id});
   *   })
   *   .then(function(teamMemberships) {
   *     var assert = require('assert');
   *     assert.equal(teamMemberships.length, 2);
   *     return webex.teamMemberships.remove(membership);
   *   })
   *   .then(function() {
   *     return webex.teamMemberships.list({teamId: team.id});
   *   })
   *   .then(function(teamMemberships) {
   *     var assert = require('assert');
   *     assert.equal(teamMemberships.length, 1);
   *     return 'success';
   *   });
   *   // => success
   */
  remove(membership) {
    const id = membership.id || membership;

    return this.request({
      method: 'DELETE',
      service: 'hydra',
      resource: `team/memberships/${id}`
    })
      .then((res) => {
        // Firefox has some issues with 204s and/or DELETE. This should move to
        // http-core
        if (res.statusCode === 204) {
          return undefined;
        }

        return res.body;
      });
  },

  /**
   * Updates properties for a membership.
   * @instance
   * @memberof TeamMemberships
   * @param {TeamMembershipObject} membership
   * @returns {Promise<TeamMembershipObject>}
   */
  update(membership) {
    const id = membership.id || membership;

    return this.request({
      method: 'PUT',
      service: 'hydra',
      resource: `team/memberships/${id}`,
      body: membership
    })
      .then((res) => res.body);
  }
});

export default TeamMemberships;
