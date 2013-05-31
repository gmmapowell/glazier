import ProxyService from 'glazier/services/proxy';
import {MockPort, MockChannel } from 'helpers/oasis_test_helpers';

module('Glazier ProxyService');

test('test ProxyService for a provider', function () {
  var port = {};
  var card = {
    id: 'card-id'
  };
  var sandbox = {
    card: card
  };
  var capability = 'service name';
  var Service = ProxyService.extend({
    registry: {
      isProvider: function (cardId, service) {
        return true;
      }
    }
  });

  var service = new Service(port, sandbox);
  ok(service, 'created service');
  service.initialize(port, capability);
});

test('test ProxyService for a consumer', function () {
  expect(5);

  var requestEventName = '@request:someEvent';
  var requestEvent = {
    requestId: 'request id'
  };
  var responseEventName = '@response:someEvent';
  var responseEvent = {
    requestId: 'request id'
  };

  var consumerCardPort = new MockPort('consumerCard');
  var proxyServicePort = new MockPort('proxyService');
  var proxyTargetPort  = new MockPort('proxyTarget');
  var providerCardPort = new MockPort('providerCard');

  var consumerChannel = new MockChannel('consumer', consumerCardPort, proxyServicePort);
  var providerChannel = new MockChannel('provider', proxyTargetPort, providerCardPort);

  var sandbox = {
    card: { id: 'card-id' }
  };

  var proxyCapability = 'service name';
  var Service = ProxyService.extend({
    registry: {
      isProvider: function (cardId, service) {
        return false;
      },
      getProxyTargetPort: function (service, capability) {
        equal(service, proxyService, 'resolve target for service name');
        equal(capability, proxyCapability, 'resolve target for service name');
        var promise = new Conductor.Oasis.RSVP.Promise();
        promise.resolve(proxyTargetPort);
        return promise;
      }
    }
  });

  var proxyService = new Service(proxyServicePort, sandbox);

  ok(proxyService, 'created service');

  proxyService.initialize(proxyServicePort, proxyCapability);

  // consumerCardPort-[consumerChannel]-proxyServicePort-[*Proxy Service*]-proxyTargetPort-[providerChannel]-providerCardPort

  providerCardPort.on(requestEventName, function (e) {
    start();
    equal(e, requestEvent, 'provider card received request event');
    providerCardPort.send(responseEventName, responseEvent);
    stop();
  });

  consumerCardPort.on(responseEventName, function (e) {
    start();
    equal(e, responseEvent, 'consumer card received response');
  });

  stop();
  consumerCardPort.send(requestEventName, requestEvent);
});

test('Test ProxyService with multiple consumers and one producer', function() {
  expect(9);

  var proxyCapability = 'ajax proxy';
  var consumer1CardPort = new MockPort('consumerCard1');
  var consumer2CardPort = new MockPort('consumerCard2');
  var consumer3CardPort = new MockPort('consumerCard3');

  var proxyService1Port = new MockPort('proxyService1');
  var proxyService2Port = new MockPort('proxyService2');
  var proxyService3Port = new MockPort('proxyService3');

  var proxyTargetPort  = new MockPort('proxyTarget');
  var ajaxCardPort     = new MockPort('ajaxCard');

  var consumer1Channel = new MockChannel('consumer1', consumer1CardPort, proxyService1Port);
  var consumer2Channel = new MockChannel('consumer2', consumer2CardPort, proxyService2Port);
  var consumer3Channel = new MockChannel('consumer3', consumer3CardPort, proxyService3Port);

  var ajaxChannel = new MockChannel('provider', proxyTargetPort, ajaxCardPort);

  var Service = ProxyService.extend({
    registry: {
      isProvider: function (cardId, service) {
        return false;
      },
      getProxyTargetPort: function (service, capability) {
        var promise = new Conductor.Oasis.RSVP.Promise();
        promise.resolve(proxyTargetPort);
        return promise;
      }
    }
  });

  var proxyService1 = new Service(proxyService1Port, { card : { id: '1' } });
  var proxyService2 = new Service(proxyService2Port, { card : { id: '2' } });
  var proxyService3 = new Service(proxyService3Port, { card : { id: '3' } });

  ok(proxyService1, 'created proxyService1');
  ok(proxyService2, 'created proxyService2');
  ok(proxyService3, 'created proxyService3');

  proxyService1.initialize(proxyService1Port, 'ajax');
  proxyService2.initialize(proxyService2Port, 'ajax');
  proxyService3.initialize(proxyService3Port, 'ajax');

  // ajaxChannel      : [ proxyTargetPort, ajaxCardPort ]
  // consumerXChannel : [ consumerXCard, proxyServiceXport]
  //
  // consumer1 <- consumer1Channel->
  // consumer2 <- consumer2Channel-> <- ajaxChannel -> ajax
  // consumer3 <- consumer3Channel->

  // sequence

  // 1. consumer1 --- request /      ---> ajax
  // 2. consumer2 --- request /posts ---> ajax

  // 3. consumer2 <-- response BAR  <--  ajax
  // 4. consumer1 <-- response FOO  <--  ajax

  // assert correct consumer gets correct response
  // assert consumer3 doesn't send or recieve
  // assert all requests finished

  var consumer1GetCount = 0;
  var consumer2GetCount = 0;

  var expectedConsumer1GetResponse = "BAR";
  var expectedConsumer2GetResponse = "FOO";

  stop();

  consumer1CardPort.on('response', function(request) {
    start();
    consumer1GetCount++;
    equal(consumer1GetCount, 1, 'the consumer1card expects only one response');
    equal(request.data, expectedConsumer1GetResponse);
  });

  consumer2CardPort.on('response', function(request) {
    consumer2GetCount++;
    equal(consumer2GetCount, 1, 'the consumer1card expects only one response');
    equal(request.data, expectedConsumer2GetResponse);
  });

  consumer3CardPort.on('response', function(e, data) {
    ok(false, 'expected consumer3Card to not recieve a response');
  });

  var RESPONSES = {
    '/':      { requestId: 1, data: 'BAR' },
    '/posts': { requestId: 2, data: 'FOO' }
  };

  var firstResponse = null;
  ajaxCardPort.on('request', function(request) {
    var data = request.data;
    var response = RESPONSES[data];

    ok(response, 'expected truthy response for: ' + request);

    // ensure out of order responses
    if (data === "/posts") {
      ajaxCardPort.send('response', firstResponse);
      ajaxCardPort.send('response', response);
    } else {
      firstResponse = response;
    }
  });

  // consumer1: ajax GET / -> proxy -> ajax
  consumer1CardPort.send('request', { requestId: 1, data: '/' });

  // consumer1: ajax GET /posts -> proxy -> ajax
  consumer2CardPort.send('request', { requestId: 2, data: '/posts'});
});
