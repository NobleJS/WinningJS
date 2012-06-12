"use strict";

jsdom = require("jsdom").jsdom

window = jsdom(null, null, features: QuerySelector: true).createWindow()
$ = require("jQuery").create(window)
Q = require("q")
WinJS =  UI: {}, Binding: {} 

Presenter = do ->
    sandboxedModule = require("sandboxed-module")

    globals =
        window: window
        document: window.document
        WinJS: WinJS
    
    sandboxedModule.require("../lib/ui/Presenter", globals: globals)

describe "Create UI presenter", ->
    present = null

    beforeEach ->
        WinJS.UI.processAll = sinon.stub().returns(Q.resolve());
        WinJS.Binding.processAll = sinon.stub().returns(Q.resolve());

    it "should result in the object having a `process` method", ->
        presenter = new Presenter(template: -> "<div></div>")
        expect(presenter).to.respondTo("process")

    it "should result in the object having an `element` promise property", ->
        presenter = new Presenter(template: -> "<div></div>")
        expect(presenter).to.have.property("element")
        Q.isPromise(presenter.element).should.be.ok

    it "should result in the object having a `winControl` promise property", ->
        presenter = new Presenter(template: -> "<div></div>")
        expect(presenter).to.have.property("winControl")
        Q.isPromise(presenter.winControl).should.be.ok

    describe "process", ->
        it "should result in an HTML element generated by executing the passed-in template", (done) ->
            presenter = new Presenter(template: -> "<section><h1>Stuff</h1><p>text</p></section>")

            presenter.process().then((element) ->
                element.tagName.should.equal("SECTION")
                $(element).find("h1").text().should.equal("Stuff")
                $(element).find("p").text().should.equal("text")
            ).should.notify(done)

        it "should call `WinJS.UI.processAll` on the resulting element", (done) ->
            presenter = new Presenter(template: -> "<p>Hi</p>")

            presenter.process().then((element) ->
                WinJS.UI.processAll.should.have.been.calledWith(element)
            ).should.notify(done)

        describe "when the template returns zero elements", ->
            it "should fail with an informative error", ->
                expect(-> new Presenter(template: -> "")).to.throw("Expected the template to render exactly one element.")

        describe "when the template returns more than one element", ->
            it "should fail with an informative error", ->
                expect(-> new Presenter(template: -> "<header></header><section></section>"))
                    .to.throw("Expected the template to render exactly one element.")

        describe "with dataContext", ->
            it "should call `WinJS.Binding.processAll` on the root element and dataContext", (done) ->
                dataContext = name: "My Name"
                presenter = new Presenter(
                    template: -> "<div><p data-win-bind=\"textContext: name \"></p></div>"
                    dataContext: dataContext
                )

                presenter.process().then((element) ->
                    WinJS.Binding.processAll.should.have.been.calledWith(element, dataContext)
                ).should.notify(done)

        describe "with renderables (both async and sync)", ->
            it "should render them", (done) ->
                renderableAsync =  
                    render: -> Q.resolve($("<p>paragraph text</p>")[0])
                renderableSync = 
                    render: -> $("<strong>strong text</strong>")[0]


                presenter = new Presenter(
                    template: -> "<section><div class='class'></div><div data-winning-region='foo'></div><div data-winning-region='bar'></div></section>"
                    renderables:
                        foo: renderableAsync
                        bar: renderableSync
                )

                presenter.process().then((element) ->
                    element.tagName.should.equal("SECTION")
                    $(element).find("div").hasClass("class").should.be.true
                    $(element).find("region").length.should.equal(0)
                    $(element).find("p").length.should.equal(1)
                    $(element).find("p").text().should.equal("paragraph text")
                    $(element).find("strong").length.should.equal(1)
                    $(element).find("strong").text().should.equal("strong text")
                ).should.notify(done)

    describe "element", ->
        it "should be equal to an HTML element generated by executing the passed-in template", (done) ->
            presenter = new Presenter(template: -> "<section><h1>Stuff</h1><p>text</p></section>")
                        
            presenter.element.then((element) ->
                element.tagName.should.equal("SECTION")
                $(element).find("h1").text().should.equal("Stuff")
                $(element).find("p").text().should.equal("text")
            ).should.notify(done)

            presenter.process()

