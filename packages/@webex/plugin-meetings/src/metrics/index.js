/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import util from 'util';

import {includes} from 'lodash';
import uuid from 'uuid';
import window from 'global/window';
import anonymize from 'ip-anonymize';

import LoggerProxy from '../common/logs/logger-proxy';
import {MEETING_ERRORS} from '../constants';
import BrowserDetection from '../common/browser-detection';

import {
  error, eventType, errorCodes as ERROR_CODE, OS_NAME, UNKNOWN, CLIENT_NAME,
  mediaType
} from './config';

const OSMap = {
  'Chrome OS': OS_NAME.chrome,
  macOS: OS_NAME.MAC,
  Windows: OS_NAME.WINDOWS,
  iOS: OS_NAME.IOS,
  Android: OS_NAME.ANDROID,
  Linux: OS_NAME.LINUX
};

const {
  getOSName,
  getOSVersion,
  getBrowserName,
  getBrowserVersion
} = BrowserDetection();

// Apply a CIDR /28 format to the IPV4 and /96 to the IPV6 addresses
// For reference : https://en.wikipedia.org/wiki/Classless_Inter-Domain_Routing
const anonymizeIPAddress = (localIp) => anonymize(localIp, 28, 96);

const triggerTimers = ({event, meeting, data}) => {
  switch (event) {
    case eventType.CALL_INITIATED:
      meeting.setStartCallInitiateJoinReq();
      break;
    case eventType.LOCUS_JOIN_REQUEST:
      meeting.setEndCallInitiateJoinReq();
      meeting.setStartJoinReqResp();
      break;
    case eventType.LOCUS_JOIN_RESPONSE:
      meeting.setEndJoinReqResp();
      meeting.setStartSetupDelay(mediaType.AUDIO);
      meeting.setStartSetupDelay(mediaType.VIDEO);
      meeting.setStartSendingMediaDelay(mediaType.AUDIO);
      meeting.setStartSendingMediaDelay(mediaType.VIDEO);
      break;
    case eventType.RECEIVING_MEDIA_START:
      meeting.setEndSetupDelay(data.mediaType);
      break;
    case eventType.SENDING_MEDIA_START:
      meeting.setEndSendingMediaDelay(data.mediaType);
      break;
    case eventType.LOCAL_SDP_GENERATED:
      meeting.setStartLocalSDPGenRemoteSDPRecvDelay();
      break;
    case eventType.REMOTE_SDP_RECEIVED:
      meeting.setEndLocalSDPGenRemoteSDPRecvDelay();
      break;
    default:
      break;
  }
};

/**
 * @description Metrics handles all the call metrics events
 * @export
 * @class Metrics
 */
class Metrics {
  /**
     * Create Metrics Object
     * @constructor
     * @public
     * @memberof Meetings
     */
  constructor() {
    if (!Metrics.instance) {
    /**
     * @instance
     * @type {Array}
     * @private
     * @memberof Metrics
     */
      this._events = [];
      /**
     * @instance
     * @type {MeetingCollection}
     * @private
     * @memberof Metrics
     */
      this.meetingCollection = null;
      /**
     * @instance
     * @type {MeetingCollection}
     * @private
     * @memberof Metrics
     */
      this.keys = Object.values(eventType);
      /**
       * @instance
       * @type {Metrics}
       * @private
       * @memberof Metrics
       */
      Metrics.instance = this;
    }

    return Metrics.instance;
  }

  /**
   * Initializes the Metrics singleton with a meeting Collection.
   *
   * @param {Object} meetingCollection meetings object
   * @param {Object} webex  webex SDK object
   *
   * @returns {void}
   */
  initialSetup(meetingCollection, webex) {
    this.meetingCollection = meetingCollection;
    this.webex = webex;
  }

  /**
   * poste Meeting event metrics
   * @param {object} options {meetingId/meeting} as a json object
   * @param {Meeting} options.meeting Meeting object
   * @param {String} options.meetingId
   * @param {object} options.data
   * @param {object} options.event
   * @returns {object} null
   */
  postEvent(options) {
    const {meetingId, data = {}, event} = options;
    let {meeting} = options;

    if (this.keys.indexOf(event) === -1) {
      LoggerProxy.logger.error(`Metrics:index#postEvent --> Event ${event} doesn't exist in dictionary`);
    }

    if (!meeting && meetingId) {
      meeting = this.meetingCollection.get(meetingId);
      options.meeting = meeting;
    }

    if (meeting) {
      triggerTimers(options);

      if (!meeting.callEvents) {
        meeting.callEvents = [];
      }
      if (event === eventType.MEDIA_QUALITY) {
        data.event = event;
        meeting.sendMediaQualityAnalyzerMetrics(data);
      }
      else {
        meeting.callEvents.push(event);
        data.event = event;
        meeting.sendCallAnalyzerMetrics(data);
      }
    }

    else {
      LoggerProxy.logger.info(`Metrics:index#postEvent --> Event received for meetingId:${meetingId}, but meeting not found in collection.`);
    }
  }

  /**
   *  Docs for Call analyzer metrics
  *   https://sqbu-github.cisco.com/WebExSquared/call-analyzer/wiki
  *   https://sqbu-github.cisco.com/WebExSquared/event-dictionary/blob/master/diagnostic-events.raml
 */

  initPayload(eventType, identifiers, options) {
    const payload = {
      eventId: uuid.v4(),
      version: 1,
      origin: {
        name: 'endpoint',
        networkType: 'unknown',
        userAgent: this.userAgentToString(),
        clientInfo: {
          clientType: options.clientType,
          clientVersion: `${CLIENT_NAME}/${this.webex.version}`,
          localNetworkPrefix: anonymizeIPAddress(this.webex.meetings.geoHintInfo?.clientAddress),
          osVersion: getOSVersion() || 'unknown',
          subClientType: options.subClientType,
          os: this.getOsName(),
          browser: getBrowserName(),
          browserVersion: getBrowserVersion()
        }
      },
      originTime: {
        triggered: new Date().toISOString()
      },
      senderCountryCode: this.webex.meetings.geoHintInfo?.countryCode,
      event: {
        name: eventType,
        canProceed: true,
        identifiers,
        eventData: {webClientDomain: window.location.hostname}
      }
    };

    // TODO: more options should be checked and some of them should be mandatory in certain conditions
    if (options) {
      if (Object.prototype.hasOwnProperty.call(options, 'canProceed')) {
        payload.event.canProceed = options.canProceed;
      }
      if (options.errors) {
        payload.event.errors = options.errors;
      }
      if (options.mediaType) {
        payload.event.mediaType = options.mediaType;
      }
      if (options.trigger) {
        payload.event.trigger = options.trigger;
      }
      if (options.pstnAudioType) {
        payload.event.pstnAudioType = options.pstnAudioType;
      }
      if (options.mediaCapabilities) {
        payload.event.mediaCapabilities = options.mediaCapabilities;
      }
      if (options.recoveredBy) {
        payload.event.recoveredBy = options.recoveredBy;
      }
      if (options.joinTimes) {
        payload.event.joinTimes = options.joinTimes;
      }
      if (options.isRoapCallEnabled) {
        payload.event.isRoapCallEnabled = options.isRoapCallEnabled;
      }
    }

    return payload;
  }

  /**
   * returns metrics friendly OS versions
   * @param {String} osName Os name
   * @returns {String}
   * @private
   * @memberof Metrics
   */
  getOsName() {
    return OSMap[getOSName()] ?? OS_NAME.OTHERS;
  }

  /**
   * get the payload specific for a media quality event through call analyzer
   * @param {String} eventType the event name
   * @param {Object} identifiers contains the identifiers needed for CA
   * @param {String} identifiers.correlationId
   * @param {String} identifiers.locusUrl
   * @param {String} identifiers.locusId
   * @param {Object} options
   * @param {Object} options.intervalData
   * @param {String} options.clientType
   * @returns {Object}
   * @public
   * @memberof Metrics
   */
  initMediaPayload(eventType, identifiers, options = {}) {
    const {audioSetupDelay, videoSetupDelay, joinTimes} = options;

    const payload = {
      eventId: uuid.v4(),
      version: 1,
      origin: {
        audioSetupDelay,
        videoSetupDelay,
        name: 'endpoint',
        networkType: options.networkType || UNKNOWN,
        userAgent: this.userAgentToString(),
        clientInfo: {
          clientType: options.clientType, // TODO: Only clientType: 'TEAMS_CLIENT' is whitelisted
          clientVersion: `${CLIENT_NAME}/${this.webex.version}`,
          localNetworkPrefix: anonymizeIPAddress(this.webex.meetings.geoHintInfo?.clientAddress),
          os: this.getOsName(),
          osVersion: getOSVersion() || UNKNOWN,
          subClientType: options.subClientType,
          browser: getBrowserName(),
          browserVersion: getBrowserVersion()
        }
      },
      originTime: {
        triggered: new Date().toISOString()
      },
      senderCountryCode: this.webex.meetings.geoHintInfo?.countryCode,
      event: {
        name: eventType,
        canProceed: true,
        identifiers,
        intervals: [options.intervalData],
        joinTimes,
        eventData: {
          webClientDomain: window.location.hostname
        },
        sourceMetadata: {
          applicationSoftwareType: CLIENT_NAME,
          applicationSoftwareVersion: this.webex.version,
          mediaEngineSoftwareType: getBrowserName() || 'browser',
          mediaEngineSoftwareVersion: getOSVersion() || UNKNOWN,
          startTime: new Date().toISOString()
        }
      }
    };

    return payload;
  }

  /**
   * This function Parses a Locus error and returns a diagnostic event payload.
   * It should keep updating from:
   * https://sqbu-github.cisco.com/WebExSquared/spark-client-framework/blob/master/spark-client-framework/Adapters/TelephonyAdapter/TelephonyAdapter.cpp#L920
   *
   * @param {Object} err the error Object from Locus response
   * @param {boolean} showToUser true if a toast is shown to user
   * @returns {{showToUser: boolean, category: string, errorDescription: string,
   *  errorCode: number, errorData: *, fatal: boolean, name: string}}
   */
  parseLocusError(err, showToUser) {
    let errorCode;

    if (err && err.statusCode && err.statusCode >= 500) {
      errorCode = 1003;
    }
    else if (err && err.body && err.body.errorCode) {
      // locus error codes: https://sqbu-github.cisco.com/WebExSquared/locus/blob/master/server/src/main/resources/locus-error-codes.properties
      switch (ERROR_CODE[err.body.errorCode]) {
        case MEETING_ERRORS.FREE_USER_MAX_PARTICIPANTS_EXCEEDED:
          errorCode = 3007;
          break;
        case MEETING_ERRORS.PAID_USER_MAX_PARTICIPANTS_EXCEEDED:
        case MEETING_ERRORS.SERVICE_MAX_PARTICIPANTS_EXCEEDED:
          errorCode = 3002;
          break;
        case MEETING_ERRORS.INACTIVE:
          errorCode = 4001;
          break;
        case MEETING_ERRORS.EXCEEDED_MAX_JOINED_PARTICIPANTS:
        case MEETING_ERRORS.EXCEEDED_SERVICE_MAX_PARTICIPANTS:
          errorCode = 3001;
          break;
        case MEETING_ERRORS.MEETING_IS_LOCKED:
          errorCode = 4002;
          break;
        case MEETING_ERRORS.MEETING_IS_TERMINATING:
          errorCode = 4003;
          break;
        case MEETING_ERRORS.MEETING_REQUIRE_MODERATOR_PIN_INTENT:
          errorCode = 4004;
          break;
        case MEETING_ERRORS.MEETING_REQUIRE_MODERATOR_PIN:
          errorCode = 4005;
          break;
        case MEETING_ERRORS.MEETING_REQUIRE_MODERATOR_ROLE:
          errorCode = 4006;
          break;
        case MEETING_ERRORS.JOIN_RESTRICTED_USER:
        case MEETING_ERRORS.GET_RESTRICTED_USER:
        case MEETING_ERRORS.CREATE_MEDIA_RESTRICTED_USER:
          errorCode = 3005;
          break;
        case MEETING_ERRORS.JOIN_RESTRICTED_USER_NOT_IN_ROOM:
          errorCode = 4007;
          break;
        case MEETING_ERRORS.MEETING_NOT_FOUND:
          errorCode = 4011;
          break;
        case MEETING_ERRORS.NOT_WEBEX_SITE:
          errorCode = 4012;
          break;
        case MEETING_ERRORS.INVALID_JOIN_TIME:
          errorCode = 4013;
          break;
        case MEETING_ERRORS.PHONE_NUMBER_NOT_A_NUMBER:
          errorCode = 4016;
          break;
        case MEETING_ERRORS.PHONE_NUMBER_TOO_LONG:
          errorCode = 4017;
          break;
        case MEETING_ERRORS.INVALID_DIALABLE_KEY:
          errorCode = 4018;
          break;
        case MEETING_ERRORS.ONE_ON_ONE_TO_SELF_NOT_ALLOWED:
          errorCode = 4019;
          break;
        case MEETING_ERRORS.REMOVED_PARTICIPANT:
          errorCode = 4020;
          break;
        case MEETING_ERRORS.MEETING_LINK_NOT_FOUND:
          errorCode = 4021;
          break;
        case MEETING_ERRORS.PHONE_NUMBER_TOO_SHORT_AFTER_IDD:
          errorCode = 4022;
          break;
        case MEETING_ERRORS.INVALID_INVITEE_ADDRESS:
          errorCode = 4023;
          break;
        case MEETING_ERRORS.PMR_ACCOUNT_LOCKED:
          errorCode = 4024;
          break;
        case MEETING_ERRORS.RESOURCE_GUEST_FORBIDDEN:
          errorCode = 4025;
          break;
        case MEETING_ERRORS.PMR_ACCOUNT_SUSPENDED:
          errorCode = 4026;
          break;
        case MEETING_ERRORS.EMPTY_PHONE_NUMBER_OR_COUNTRY_CODE:
          errorCode = 4027;
          break;
        case MEETING_ERRORS.INVALID_SINCE_OR_SEQUENCE_HASH_IN_REQUEST:
          errorCode = 1006;
          break;
        case MEETING_ERRORS.CONVERSATION_NOT_FOUND:
          errorCode = 4028;
          break;
        case MEETING_ERRORS.RECORDING_CONTROL_NOT_SUPPORTED:
        case MEETING_ERRORS.RECORDING_NOT_STARTED:
        case MEETING_ERRORS.RECORDING_NOT_ENABLED:
          errorCode = 4029;
          break;
        default:
          errorCode = 4008;
      }
    }
    else {
      errorCode = 4008;
    }

    return this.generateErrorPayload(
      errorCode, showToUser, error.name.LOCUS_RESPONSE, err
    );
  }


  generateErrorPayload(errorCode, shownToUser, name, err) {
    if (error.errors[errorCode]) {
      const errorPayload = {
        shownToUser: shownToUser || false,
        category: error.errors[errorCode][2],
        errorDescription: error.errors[errorCode][0],
        errorCode,
        fatal: !includes(error.notFatalErrorList, errorCode),
        name: name || error.name.OTHER
      };

      if (err && err.body) {
        errorPayload.errorData = err.body;
      }

      if (err && err.statusCode) {
        errorPayload.httpCode = err.statusCode;
      }

      return errorPayload;
    }

    return null;
  }

  /**
   * Returns a formated string of the user agent.
   *
   * @returns {string} formatted user agent information
   */
  userAgentToString() {
    let userAgentOption;
    let browserInfo;
    const clientInfo = util.format('client=%s', `${this.webex.meetings?.metrics?.clientName}`);

    if (['chrome', 'firefox', 'msie', 'msedge', 'safari'].indexOf(getBrowserName().toLowerCase()) !== -1) {
      browserInfo = util.format('browser=%s', `${getBrowserName().toLowerCase()}/${getBrowserVersion().split('.')[0]}`);
    }
    const osInfo = util.format('os=%s', `${getOSName()}/${getOSVersion().split('.')[0]}`);

    if (browserInfo) {
      userAgentOption = `(${browserInfo}`;
    }
    if (osInfo) {
      userAgentOption = userAgentOption ? `${userAgentOption}; ${clientInfo}; ${osInfo}` : `${clientInfo}; (${osInfo}`;
    }
    if (userAgentOption) {
      userAgentOption += ')';

      return util.format('webex-js-sdk/%s %s', `${process.env.NODE_ENV}-${this.webex.version}`, userAgentOption);
    }

    return util.format('webex-js-sdk/%s', `${process.env.NODE_ENV}-${this.webex.version}`);
  }

  /**
   * Uploads given metric to the Metrics service as an Behavioral metric.
   * Metadata about the environment such as browser, OS, SDK and their versions
   * are automatically added when the metric is sent.
   *
   * The Metrics service will send an Behavioral metric to InfluxDB for
   * aggregation.
   * See https://confluence-eng-gpk2.cisco.com/conf/display/WBXT/Getting+started+with+Metrics+Service.
   *
   * @param {string} metricName  Name of the metric (measurement) to send
   * @param {Object} metricFields  Key-valye pairs of data or values about this metric
   * @param {Object} metricTags  Key-value pairs of metric metadata
   *
   * @returns {void}
   */
  sendBehavioralMetric(metricName, metricFields = {}, metricTags = {}) {
    this.webex.internal.metrics.submitClientMetrics(metricName, {
      type: this.webex.config.metrics.type,
      fields: metricFields,
      tags: metricTags
    });
  }
}

// Export Metrics singleton ---------------------------------------------------
const instance = new Metrics();

export default instance;
