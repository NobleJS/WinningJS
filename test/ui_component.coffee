"use strict"

jsdom = require("jsdom").jsdom

window = jsdom(null, null, features: QuerySelector: true).createWindow()
$ = require("jQuery").create(window)
WinJS = { UI: {} }

{ create: createUIComponent, mixin: mixinUIComponent } = do ->
    sandboxedModule = require("sandboxed-module")

    globals =
        window: window
        document: window.document
        WinJS: WinJS
    
    return sandboxedModule.require("../lib/ui/component", globals: globals)


describe "Create UI component", ->
    beforeEach ->
        WinJS.UI.processAll = sinon.spy()

    it "should result in the object having a `render` method", ->
        component = createUIComponent()

        expect(component).to.respondTo("render")

    describe "render", ->
        it "should result in an HTML element generated by executing the passed-in template", ->
            component = createUIComponent(template: -> "<section><h1>Stuff</h1><p>text</p></section>")

            element = component.render()

            element.tagName.should.equal("SECTION")
            $(element).find("h1").text().should.equal("Stuff")
            $(element).find("p").text().should.equal("text")

        it "should call `WinJS.UI.processAll` on the resulting element", ->
            component = createUIComponent(template: -> "<p>Hi</p>")

            element = component.render()

            WinJS.UI.processAll.should.have.been.calledWith(element)

        describe "when the template returns zero elements", ->
            it "should fail with an informative error", ->
                component = createUIComponent(template: -> "")

                expect(-> component.render()).to.throw("exactly one element")

        describe "when the template returns more than one element", ->
            it "should fail with an informative error", ->
                component = createUIComponent(template: -> "<header></header><section></section>")

                expect(-> component.render()).to.throw("exactly one element")

        describe "with sub-components", ->
            it "should render them", ->
                subComponent = createUIComponent(template: -> "<p>text</p>")
                component = createUIComponent(
                    template: -> "<section><div class='class'></div><div data-region='sub'></div></section>"
                    components:
                        sub: subComponent
                )

                element = component.render()

                element.tagName.should.equal("SECTION")
                $(element).find("div").hasClass("class").should.be.true
                $(element).find("region").length.should.equal(0)
                $(element).find("p").length.should.equal(1)
                $(element).find("p").text().should.equal("text")
