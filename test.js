
const request = require('supertest');
const server = require('./server'); // Your Express app
const app=server.app
const Event = server.Event
const { expect } = require('chai');
const sinon = require('sinon');


describe('Event Routes (Unit Tests)', function () {
    let testEventId;
    let findOneAndUpdateStub;
    let findByIdAndDeleteStub;
    let saveStub;
    let findStub;

    before(async () => {
        //stub mongoose functions
        findOneAndUpdateStub = sinon.stub(Event, 'findOneAndUpdate');
        findByIdAndDeleteStub = sinon.stub(Event, 'findByIdAndDelete');
        saveStub = sinon.stub(Event.prototype, 'save');
        findStub = sinon.stub(Event, 'find');
    });

    afterEach(() => {
        sinon.restore();
    })

    describe('GET /events', function () {
        it('responds with json and events array', async function () {
            const mockEvents = [{ title: "Event 1" }, { title: "Event 2" }];
            findStub.resolves(mockEvents);

            const res = await request(app)
                .get('/events')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(res.body).to.be.an('array');
            expect(res.body).to.deep.equal(mockEvents);
            expect(findStub.calledOnce).to.be.true;
        });
        it('responds with 500 on error', async function () {
            findStub.rejects(new Error('Database error'));
            const res = await request(app).get('/events').expect(500);
            expect(res.body.message).to.equal('Error fetching events');
        });
    });

    describe('POST /events', function () {
        it('creates a new event', async function () {
            const mockEvent = { _id: "mockId", title: "Test Event", description: "test description", location: "test location", date: "2024-12-12" };
            saveStub.resolves(mockEvent);

            const res = await request(app)
                .post('/events')
                .set('Content-Type', 'application/json')
                .send({ title: "Test Event", description: "test description", location: "test location", date: "2024-12-12" })
                .expect(201);

            expect(res.body).to.be.an('object');
            expect(res.body).to.deep.equal(mockEvent);
            expect(saveStub.calledOnce).to.be.true;
        });
        it('should return validation error if title is missing', async function () {
            const res = await request(app)
                .post('/events')
                .set('Content-Type', 'application/json')
                .send({ description: "test description", location: "test location", date: "2024-12-12" })
                .expect(400);
            expect(res.body.message).to.equal("Validation error");
            expect(res.body.details).to.include("Title is required");
        });
        it('responds with 500 on error', async function () {
            saveStub.rejects(new Error('Database error'));
            const res = await request(app).post('/events').set('Content-Type', 'application/json').send({ title: "Test Event", description: "test description", location: "test location", date: "2024-12-12" }).expect(500);
            expect(res.body.message).to.equal('Error saving event');
        });
    });

    describe('PUT /events/:id', function () {
        it('updates an existing event', async function () {
            const mockEvent = { _id: "mockId", title: "Updated Event", __v: 1 };
            findOneAndUpdateStub.resolves(mockEvent);

            const res = await request(app)
                .put('/events/mockId')
                .set('Content-Type', 'application/json')
                .send({ title: "Updated Event", __v: 0 })
                .expect(200);

            expect(res.body).to.deep.equal(mockEvent);
            expect(findOneAndUpdateStub.calledOnce).to.be.true;
        });

        it('should return 409 if version is incorrect', async () => {
            findOneAndUpdateStub.resolves(null);

            const res = await request(app)
                .put('/events/mockId')
                .set('Content-Type', 'application/json')
                .send({ title: "Failed Update", __v: 0 })
                .expect(409);

            expect(res.body.message).to.equal("Event has been updated by another user. Please refresh.");
            expect(findOneAndUpdateStub.calledOnce).to.be.true;
        });
        it('responds with 500 on error', async function () {
            findOneAndUpdateStub.rejects(new Error('Database error'));
            const res = await request(app).put('/events/mockId').set('Content-Type', 'application/json').send({ title: "Updated Event", __v: 0 }).expect(500);
            expect(res.body.message).to.equal('Error updating event');
        });
    });

    describe('DELETE /events/:id', function () {
        it('deletes an existing event', async function () {
            const mockEvent = { _id: "mockId" };
            findByIdAndDeleteStub.resolves(mockEvent);

            const res = await request(app)
                .delete('/events/mockId')
                .expect(200);

            expect(res.body.message).to.equal("Event deleted successfully");
            expect(findByIdAndDeleteStub.calledOnce).to.be.true;
        });
        it('responds with 404 if event not found', async function () {
            findByIdAndDeleteStub.resolves(null);
            const res = await request(app).delete('/events/mockId').expect(404);
            expect(res.body.message).to.equal("Event not found");
        });
        it('responds with 500 on error', async function () {
            findByIdAndDeleteStub.rejects(new Error('Database error'));
            const res = await request(app).delete('/events/mockId').expect(500);
            expect(res.body.message).to.equal('Error deleting event');
        });
    });
});