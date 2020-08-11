import React from "react";
import GECanvas from "./canvas";
import GEElementData from "./element-data";
import {defaultContextMenuOptions, defaultCytoscapeStyleOptions, defaultLayoutOptions} from "../core/constants";
import cytoscape from "cytoscape";
import cxtmenu from "cytoscape-cxtmenu";
import cola from "cytoscape-cola";
import GremlinResponseSerializers from "../gremlin/serializer";
import GEEvents from "../core/events";
import GEActions from "../core/actions";
import {centerElement} from "../core/utils";
import {HTTPConnector} from "../gremlin/connector";

const actions = new GEActions();
cytoscape.use(cxtmenu);
cytoscape.use(cola);
const gremlinSerializer = new GremlinResponseSerializers();


export default class GECanvasContainer extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            selectedElement: null
        }

        this.connector = new HTTPConnector({
            gremlinUrl: this.props.gremlinUrl,
            extraHeaders: {},
            callback: this.processResponse.bind(this)
        })
    }

    processResponse(response, extraCallback) {
        /*
        This method will get response from gremlin server and
        separates them into nodes and links.

        extraCallback is triggered after the updateData func.

        returns {"nodes": [], "links": []}
         */
        const result = gremlinSerializer.process(response)
        const nodesAndLinks = gremlinSerializer.separateVerticesAndEdges(result, false);
        this.updateData(nodesAndLinks['nodes'], nodesAndLinks['links']);
        if (extraCallback) {
            extraCallback(nodesAndLinks);
        }

    }

    static defaultProps = {
        gremlinUrl: null
    }

    setupMenuOptions() {

        let _this = this;
        let menuOptions = defaultContextMenuOptions;
        menuOptions.commands = [{ // example command
            fillColor: 'rgba(200, 200, 200, 0.75)', // optional: custom background color for item
            content: 'inV', // html/text content to be displayed in the menu
            contentStyle: {}, // css key:value pairs to set the command's css in js if you want
            select: function (ele) { // a function to execute when the command is selected
                console.log(ele.id()); // `ele` holds the reference to the active element
                const nodeId = ele.id();
                const query_string = "node=g.V(" + nodeId + ").toList(); " +
                    "edges = g.V(" + nodeId + ").outE().dedup().toList(); " +
                    "other_nodes = g.V(" + nodeId + ").outE().otherV().dedup().toList();" +
                    "[other_nodes,edges,node]";

                _this.connector.makeQuery(query_string, (nodesAndLinks) => {
                    if (nodesAndLinks['nodes'].length > 0) {
                        _this.layout.on("layoutstop", function () {
                            centerElement(ele, _this.cy);
                        });
                    }
                })

            },
            enabled: true // whether the command is selectable
        }, { // example command
            fillColor: 'rgba(200, 200, 200, 0.75)', // optional: custom background color for item
            content: 'outV', // html/text content to be displayed in the menu
            contentStyle: {}, // css key:value pairs to set the command's css in js if you want
            select: function (ele) { // a function to execute when the command is selected
                console.log(ele.id()); // `ele` holds the reference to the active element
                const nodeId = ele.id();
                let query_string = "node=g.V(" + nodeId + ").toList(); " +
                    "edges = g.V(" + nodeId + ").inE().dedup().toList(); " +
                    "other_nodes = g.V(" + nodeId + ").inE().otherV().dedup().toList();" +
                    "[other_nodes,edges,node]";
                console.log("nodeId", nodeId);

                _this.connector.makeQuery(query_string, (nodesAndLinks) => {
                    if (nodesAndLinks['nodes'].length > 0) {
                        _this.layout.on("layoutstop", function () {
                            centerElement(ele, _this.cy);
                        });
                    }
                })

            },
            enabled: true // whether the command is selectable
        }];
        this.menu = this.cy.cxtmenu(defaultContextMenuOptions);


    }

    componentDidMount() {
        this.cy = this.createCytoscapeInstance();
        this.setupNodeEvents(); //
        this.setupMenuOptions();
    }

    createCytoscapeInstance() {
        console.log("render graph triggered");
        const layoutOptions = defaultCytoscapeStyleOptions;
        layoutOptions.container = document.querySelector("#graph-canvas");
        layoutOptions.layout = defaultLayoutOptions;
        return cytoscape(layoutOptions);
    }


    setupNodeEvents() {
        /*
        this will set events for what happens when node is
        hovered, clicked, dragged, drag stopped etc.

         */
        let _this = this;
        const events = new GEEvents();

        this.cy.on('tap', (event) => {
            const element = events.OnTap(event, this.cy)
            if (element) {
                actions.highLightNeighbourNodes(element, _this.cy);
            }
        });

        this.cy.on('tapdrag', (event) => events.onTagDrag(event, this.cy));
        this.cy.on('tapdragout', (event) => {
            _this.setState({selectedElement: null});
            events.onTapDragOut(event, _this.cy)
        });

        this.cy.on('tapstart', (event) => {
            const element = events.OnTap(event, this.cy)

            if (element) {
                _this.setState({selectedElement: element});
                events.onTapStart(event, this.cy)
            }
        });
        this.cy.on('tapend', (event) => events.onTapEnded(event, this.cy));


        this.cy.on('layoutstart', function (e) {
            // Notice the layoutstart event with the layout name.
            console.log('layoutstart', e.target.options.name);
        });

        this.cy.on('layoutstop', function (e) {
            // Notice the layoutstop event with the layout name.
            console.log('layoutstop', e.target.options.name);
        });
    }

    lockNodes() {
        console.log("lockNodes triggered");
        this.cy.nodes().lock();
    }

    unlockNodes() {
        console.log("unlockNodes triggered");
        this.cy.nodes().unlock();
    }

    updateData(nodes, edges) {
        let _this = this;
        this.lockNodes();


        let nodes_cleaned = [];
        // Create new parent
        nodes.forEach(data => {
            nodes_cleaned.push({
                group: "nodes",
                data: data
            });
        });

        let edges_cleaned = [];
        edges.forEach(data => {
            edges_cleaned.push({
                group: "edges",
                data: data
            });
        });

        console.log("nodes", nodes_cleaned);
        console.log("edges", edges_cleaned);

        if (this.layout) {
            this.layout.stop();
        }
        this.cy.add(nodes_cleaned);
        this.cy.add(edges_cleaned);

        this.layout = this.cy.elements().makeLayout(defaultLayoutOptions);
        this.layout.run();

        this.layout.on("layoutstop", function () {
            _this.unlockNodes();
            //... unload spinner here
        });
        // _this.unlockNodes();

    }


    getMenu() {
        return this.menu;
    }

    getCyInstance() {
        return this.cy;
    }

    setCyInstance(cy) {
        this.cy = cy;
    }

    render() {
        return (
            <div className="App">
                <GECanvas
                    getCyInstance={this.getCyInstance.bind(this)}
                    setCyInstance={this.setCyInstance.bind(this)}
                    getMenu={this.getMenu.bind(this)}
                    updateData={this.updateData.bind(this)}
                    connector={this.connector}
                />
                <GEElementData selectedElement={this.state.selectedElement}/>
            </div>
        );
    }
}
