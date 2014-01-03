pc.extend(pc.fw, function () {
       
    /**
     * @name pc.fw.CollisionComponentSystem
     * @constructor Creates a new CollisionComponentSystem.
     * @class Manages creation of {@link pc.fw.CollisionComponent}s.
     * @param {pc.fw.ApplicationContext} context The ApplicationContext for the running application.
     * @extends pc.fw.ComponentSystem
     */    
     var CollisionComponentSystem = function CollisionComponentSystem (context) {
        this.id = "collision";
        this.description = "Specifies a collision volume.";
        context.systems.add(this.id, this);

        this.ComponentType = pc.fw.CollisionComponent;
        this.DataType = pc.fw.CollisionComponentData;

        this.schema = [{
            name: "type",
            displayName: "Type",
            description: "The type of the collision volume",
            type: "enumeration",
            options: {
                enumerations: [{
                    name: 'Box',
                    value: 'box'
                }, {
                    name: 'Sphere',
                    value: 'sphere'
                }, {
                    name: 'Capsule',
                    value: 'capsule'
                }, {
                    name: 'Cylinder',
                    value: 'cylinder'
                }, {
                    name: 'Mesh',
                    value: 'mesh'
                }]
            },
            defaultValue: "box"
        },{
            name: "halfExtents",
            displayName: "Half Extents",
            description: "The half-extents of the box",
            type: "vector",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: [0.5, 0.5, 0.5],
            filter: {
                type: "box"
            }
        }, {
            name: "radius",
            displayName: "Radius",
            description: "The radius of the collision volume",
            type: "number",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: 0.5,
            filter: {
                type: ["sphere", "capsule", "cylinder"]
            }
        }, {
            name: "axis",
            displayName: "Axis",
            description: "Major axis of the volume",
            type: "enumeration",
            options: {
                enumerations: [{
                    name: 'X',
                    value: 0
                }, {
                    name: 'Y',
                    value: 1
                }, {
                    name: 'Z',
                    value: 2
                }]
            },
            defaultValue: 1,
            filter: {
                type: ["capsule", "cylinder"]
            }
        }, {
            name: "height",
            displayName: "Height",
            description: "Height of the volume",
            type: "number",
            options: {
                min: 0,
                step: 0.1
            },
            defaultValue: 2,
            filter: {
                type: ["capsule", "cylinder"]
            }
        }, {
            name: "asset",
            displayName: "Asset",
            description: "Collision mesh asset",
            type: "asset",
            options: {
                max: 1,
                type: 'model'
            },
            defaultValue: null,
            filter: {
                type: "mesh"
            }
        }, {
            name: "shape",
            exposed: false
        }, {
            name: 'model',
            exposed: false
        }];

        this.exposeProperties();
        this.implementations = {};
        this.debugRender = false;

        this.on('remove', this.onRemove, this);

        pc.fw.ComponentSystem.on('update', this.onUpdate, this);
        pc.fw.ComponentSystem.on('toolsUpdate', this.onToolsUpdate, this);
    };

    CollisionComponentSystem = pc.inherits(CollisionComponentSystem, pc.fw.ComponentSystem);

    CollisionComponentSystem.prototype = pc.extend(CollisionComponentSystem.prototype, {
        initializeComponentData: function (component, data, properties) {

            if (!data.type) {
                data.type = component.data.type;
            }

            component.data.type = data.type;

            var impl = this._createImplementation(data.type);
            impl.beforeInitialize(component, data);

            properties = ['type', 'halfExtents', 'radius', 'axis', 'height', 'shape', 'model', 'asset'];
            CollisionComponentSystem._super.initializeComponentData.call(this.system, component, data, properties);

            impl.afterInitialize(component, data);
        },

        /**
        * @private
        * Creates an implementation based on the collision type and caches it 
        * in an internal implementations structure, before returning it.
        */
        _createImplementation: function (type) {
            if (typeof this.implementations[type] === 'undefined') {
                var impl;
                switch (type) {
                    case 'box':
                        impl = new CollisionBoxSystemImpl(this);
                        break;
                    case 'sphere':
                        impl = new CollisionSphereSystemImpl(this);
                        break;
                    case 'capsule':
                        impl = new CollisionCapsuleSystemImpl(this);
                        break;
                    case 'cylinder':
                        impl = new CollisionCylinderSystemImpl(this);
                        break;
                    case 'mesh':
                        impl = new CollisionMeshSystemImpl(this);
                        break;
                    default:
                        throw "Invalid collision system type: " + type;
                        break;
                }
                this.implementations[type] = impl;
            }

            return this.implementations[type];
        },

        /**
        * @private
        * Gets an existing implementation for the specified entity
        */
        _getImplementation: function (entity) {
            return this.implementations[entity.collision.data.type];
        },

        cloneComponent: function (entity, clone) {
            return this._getImplementation(entity).clone(entity, clone);
        },
        
        onRemove: function (entity, data) {
            this.implementations[data.type].remove(entity, data);
        },

        onUpdate: function (dt) {
            var id, entity;
            var components = this.store;
            
            for (id in components) {
                entity = components[id].entity;
                
                if (!entity.rigidbody) {
                    entity.trigger.syncEntityToBody();
                }
                
                if (this.debugRender) {
                    this.updateDebugShape(entity, components[id].data, this._getImplementation(entity));
                }
            }

        },

        updateDebugShape: function (entity, data, impl) {
            var context = this.context;

            if (typeof impl !== 'undefined') {
                if (impl.hasDebugShape) {
                    if (data.model) {
                        if (!context.scene.containsModel(data.model)) {
                            context.scene.addModel(data.model);
                            context.root.addChild(data.model.graph);
                        }
                    }

                    impl.updateDebugShape(entity, data);
                } 
            }
        },

        onTransformChanged: function(component, position, rotation, scale) {
            this.implementations[component.data.type].updateTransform(component, position, rotation, scale);
        },

        onToolsUpdate: function (dt) {
            var id, entity;
            var components = this.store;
            
            for (id in components) {
                entity = components[id].entity;
                this.updateDebugShape(entity, components[id].data, this._getImplementation(entity));
            }
        },

        /**
        * @function
        * @name pc.fw.CollisionComponentSystem#setDebugRender
        * @description Display collision shape outlines
        * @param {Boolean} value Enable or disable
        */
        setDebugRender: function (value) {
            this.debugRender = value;
        },

        /**
        * @private
        * Destroys the previous collision type and creates a new one
        * based on the new type provided
        */
        changeType: function (component, previousType, newType) {
             this.implementations[previousType].remove( component.entity, component.data);
             this._createImplementation(newType).reset(component, component.data);
        },

        /**
        * @private
        * Recreates rigid bodies or triggers for the specified component
        */
        recreatePhysicalShapes: function (component) {
            this.implementations[component.data.type].recreatePhysicalShapes(component); 
        }
    });

    /** 
    * Collision system implementations
    */
    CollisionSystemImpl = function (system) {
        this.system = system;
        // set this to false if you don't want to create a debug shape
        this.hasDebugShape = true; 
    };

    CollisionSystemImpl.prototype = {
        /**
        * @private 
        * Called before the call to system.super.initializeComponentData is made
        */
        beforeInitialize: function (component, data) {
            data.shape = this.createPhysicalShape(component.entity, data);

            data.model = new pc.scene.Model();
            data.model.graph = new pc.scene.GraphNode();
            data.model.meshInstances = [this.createDebugMesh(component.entity, data)];
        },

        /** 
        * @private
        * Called after the call to system.super.initializeComponentData is made
        */
        afterInitialize: function (component, data) {
            this.recreatePhysicalShapes(component);
        },

        /**
        * @private
        * Called when a collision component changes type in order to 
        * recreate debug and physical shapes
        */
        reset: function (component, data) {
            this.beforeInitialize(component, data);
            this.afterInitialize(component, data);
        },

        /**
        * @private
        * Re-creates rigid bodies / triggers
        */
        recreatePhysicalShapes: function (component) {
            var entity = component.entity;
            var data = component.data;

            if (typeof(Ammo) !== 'undefined') {
                data.shape = this.createPhysicalShape(component.entity, data);
                if (entity.rigidbody) {
                    entity.rigidbody.createBody();
                } else {
                    if (!entity.trigger) {
                        entity.trigger = new pc.fw.Trigger(this.system.context, component, data);
                    }
                    entity.trigger.initialize(data);
                }
            }
        },

        /**
        * @private
        * Optionally creates a debug mesh instance for a collision
        */
        createDebugMesh: function (entity, data) {
            return undefined;
        },

        /** 
        * @private
        * Creates a physical shape for the collision. This consists
        * of the actual shape that will be used for the rigid bodies / triggers of 
        * the collision.
        */
        createPhysicalShape: function (entity, data) {
            return undefined;
        },

        /** 
        * @private
        * Updates the transform of the debug shape if one exists
        */
        updateDebugShape: function (entity, data) { 
        },

        updateTransform: function(component, position, rotation, scale) {
            if (component.entity.trigger) {
                component.entity.trigger.syncEntityToBody();
            }
        },

        /**
        * @private
        * Called when the collision is removed 
        */
        remove: function (entity, data) {
            var context = this.system.context;
            if (entity.rigidbody && entity.rigidbody.body) {
                context.systems.rigidbody.removeBody(entity.rigidbody.body);
            }

            if (entity.trigger) {
                entity.trigger.destroy();
            }

            if (context.scene.containsModel(data.model)) {
                context.root.removeChild(data.model.graph);
                context.scene.removeModel(data.model);
            }
        },

        /**
        * @private
        * Called when the collision is cloned to another entity
        */
        clone: function (entity, clone) {
            var src = this.system.dataStore[entity.getGuid()];

            var data = {
                type: src.data.type,
                halfExtents: pc.extend([], src.data.halfExtents),
                radius: src.data.radius,
                axis: src.data.axis,
                height: src.data.height,
                asset: src.data.asset,
                model: src.data.model
            };

            //if (src.data.model) {
            //    data.model = src.data.model.clone();
            //}

            return this.system.addComponent(clone, data);  
        },

        /** 
        * @private
        * Returns the world scale of the specified entity
        */
        getWorldScale: function (entity) {
            var worldTransform = entity.getWorldTransform();
            return pc.math.mat4.getScale(worldTransform);
        }
    };

    /**
    /* Box Collision System
    */
    CollisionBoxSystemImpl = function (system) {};

    CollisionBoxSystemImpl = pc.inherits(CollisionBoxSystemImpl, CollisionSystemImpl);

    CollisionBoxSystemImpl.prototype = pc.extend(CollisionBoxSystemImpl.prototype, {

        createDebugMesh: function (entity, data) {
            if (!this.mesh) {
                var gd = this.system.context.graphicsDevice;

                var format = new pc.gfx.VertexFormat(gd, [
                    { semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
                ]);

                var vertexBuffer = new pc.gfx.VertexBuffer(gd, format, 8);
                var positions = new Float32Array(vertexBuffer.lock());
                positions.set([
                    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
                    -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5
                ]);
                vertexBuffer.unlock();

                var indexBuffer = new pc.gfx.IndexBuffer(gd, pc.gfx.INDEXFORMAT_UINT8, 24);
                var indices = new Uint8Array(indexBuffer.lock());
                indices.set([
                    0,1,1,2,2,3,3,0,
                    4,5,5,6,6,7,7,4,
                    0,4,1,5,2,6,3,7
                ]);
                indexBuffer.unlock();

                var mesh = new pc.scene.Mesh();
                mesh.vertexBuffer = vertexBuffer;
                mesh.indexBuffer[0] = indexBuffer;
                mesh.primitive[0].type = pc.gfx.PRIMITIVE_LINES;
                mesh.primitive[0].base = 0;
                mesh.primitive[0].count = indexBuffer.getNumIndices();
                mesh.primitive[0].indexed = true;
                this.mesh = mesh;
            }
            
            if (!this.material) {
                var material = new pc.scene.BasicMaterial();
                material.color = pc.math.vec4.create(0, 0, 1, 1);
                material.update()
                this.material = material;
            }

            return new pc.scene.MeshInstance(data.model.graph, this.mesh, this.material);
        },

        createPhysicalShape: function (entity, data) {
            if (typeof(Ammo) !== 'undefined') {
                var scale = this.getWorldScale(entity);

                return new Ammo.btBoxShape( 
                    new Ammo.btVector3(
                        scale[0] * data.halfExtents[0], 
                        scale[1] * data.halfExtents[1], 
                        scale[2] * data.halfExtents[2]
                    ));    
            } else {
                return undefined;
            }
        },

        updateDebugShape : function (entity, data) {
            var x = data.halfExtents[0];
            var y = data.halfExtents[1];
            var z = data.halfExtents[2];
            var scale = this.getWorldScale(entity);

            var root = data.model.graph;
            root.setPosition(entity.getPosition());
            root.setRotation(entity.getRotation());
            root.setLocalScale(scale[0] * x / 0.5, scale[1] * y / 0.5, scale[2] * z / 0.5);
        },

        updateTransform: function(component, position, rotation, scale) {
            this.recreatePhysicalShapes(component);
            CollisionBoxSystemImpl._super.updateTransform.call(this, component, position, rotation, scale);
        }
    });

    /**
    /* Sphere Collision System
    */
    
    CollisionSphereSystemImpl = function (system) {};

    CollisionSphereSystemImpl = pc.inherits(CollisionSphereSystemImpl, CollisionSystemImpl);

    CollisionSphereSystemImpl.prototype = pc.extend(CollisionSphereSystemImpl.prototype, {
        createDebugMesh: function (entity, data) {
            if (!this.mesh) {
                var context = this.system.context;
                var gd = context.graphicsDevice;

                // Create the graphical resources required to render a camera frustum
                var format = new pc.gfx.VertexFormat(gd, [
                    { semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
                ]);

                var vertexBuffer = new pc.gfx.VertexBuffer(gd, format, 240);
                var positions = new Float32Array(vertexBuffer.lock());

                var i, x = 0;
                var theta;
                for (var ring = 0; ring < 3; ring++) {
                    var xo = 0;
                    var yo = 1;
                    var zo = 2;
                    if (ring === 1) {
                        xo = 1;
                        yo = 0;
                        zo = 2;
                    } else if (ring === 2) {
                        xo = 0;
                        yo = 2;
                        zo = 1;
                    }

                    for (i = 0; i < 40; i++) {
                        theta = 2 * Math.PI * (i / 40);
                        positions[x+xo] = 0.5 * Math.cos(theta);
                        positions[x+yo] = 0;
                        positions[x+zo] = 0.5 * Math.sin(theta);
                        x += 3;

                        theta = 2 * Math.PI * ((i + 1) / 40);
                        positions[x+xo] = 0.5 * Math.cos(theta);
                        positions[x+yo] = 0;
                        positions[x+zo] = 0.5 * Math.sin(theta);
                        x += 3;
                    }
                }

                vertexBuffer.unlock();

                var mesh = new pc.scene.Mesh();
                mesh.vertexBuffer = vertexBuffer;
                mesh.primitive[0].type = pc.gfx.PRIMITIVE_LINES;
                mesh.primitive[0].base = 0;
                mesh.primitive[0].count = vertexBuffer.getNumVertices();
                mesh.primitive[0].indexed = false;
                
                this.mesh = mesh;
            }
            
            if (!this.material) {
                var material = new pc.scene.BasicMaterial();
                material.color = pc.math.vec4.create(0, 0, 1, 1);
                material.update();
                this.material = material;
            }

            return new pc.scene.MeshInstance(data.model.graph, this.mesh, this.material);
        },
    
        createPhysicalShape: function (entity, data) {
            if (typeof(Ammo) !== 'undefined') {
                var scaledRadius = this.getScaledRadius(entity, data.radius);
                return new Ammo.btSphereShape(scaledRadius);   
            } else {
                return undefined;
            }
        },

        /**
        * Scales the radius in each direction and returns the max value between all 
        * the directions and the initial radius
        */
        getScaledRadius: function (entity, radius) {
            var scale = this.getWorldScale(entity);
            return Math.max(Math.max(Math.max(radius*scale[0], radius*scale[1]), radius*scale[2]), radius);
        },

        updateDebugShape: function (entity, data) {
            var root = data.model.graph;
            root.setPosition(entity.getPosition());
            root.setRotation(entity.getRotation());

            var scaledRadius = this.getScaledRadius(entity, data.radius);
            root.setLocalScale(scaledRadius / 0.5, scaledRadius / 0.5, scaledRadius / 0.5);
        },

        updateTransform: function(component, position, rotation, scale) {
            this.recreatePhysicalShapes(component);
            CollisionSphereSystemImpl._super.updateTransform.call(this, component, position, rotation, scale);
        }
    });

    /**
    /* Capsule Collision System
    */
    
    CollisionCapsuleSystemImpl = function (system) {};

    CollisionCapsuleSystemImpl = pc.inherits(CollisionCapsuleSystemImpl, CollisionSystemImpl);

    CollisionCapsuleSystemImpl.prototype = pc.extend(CollisionCapsuleSystemImpl.prototype, {
        createDebugMesh: function (entity, data) {            
            // The capsule collision system creates a separate debug mesh
            // for each capsule because of its particular shape. So if a mesh has already
            // been created for this component then return it, otherwise create a new one
            if (data.model && data.model.meshInstances && data.model.meshInstances.length) {
                return data.model.meshInstances[0];
            } else {
                var gd = this.system.context.graphicsDevice;

                // Create the graphical resources required to render a capsule shape
                var format = new pc.gfx.VertexFormat(gd, [
                    { semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
                ]);

                var vertexBuffer = new pc.gfx.VertexBuffer(gd, format, 328, pc.gfx.BUFFER_DYNAMIC);
                this.updateCapsuleShape(entity, data, vertexBuffer);

                var mesh = new pc.scene.Mesh();
                mesh.vertexBuffer = vertexBuffer;
                mesh.primitive[0].type = pc.gfx.PRIMITIVE_LINES;
                mesh.primitive[0].base = 0;
                mesh.primitive[0].count = vertexBuffer.getNumVertices();
                mesh.primitive[0].indexed = false;
            }
            
            // no need to create a new material for each capsule shape
            if (!this.material) {
                var material = new pc.scene.BasicMaterial();
                material.color = pc.math.vec4.create(0, 0, 1, 1);
                material.update();
                this.material = material;    
            }

            return new pc.scene.MeshInstance(data.model.graph, mesh, this.material);
        },

        /**
        * Scales the radius on all axes except the height axis and returns the 
        * max value between the axes and the original radius
        */
        getScaledRadius: function (radius, scale, axis) {
            radius = radius || 0.5;
            return Math.max(Math.max(radius, radius * scale[(axis+1)%3]), radius * scale[(axis+2)%3]);
        },

        getScaledHeight: function (height, scale, radius, axis) {
            height = height || 2;
            return Math.max(height * scale[axis] - 2 * radius, 0);
        },

        updateCapsuleShape: function(entity, data, vertexBuffer) {
            var axis = (typeof data.axis !== 'undefined') ? data.axis : 1;
            var scale = this.getWorldScale(entity);            
            var radius = this.getScaledRadius(data.radius, scale, axis);
            var height = this.getScaledHeight(data.height, scale, radius, axis); 

            var positions = new Float32Array(vertexBuffer.lock());

            var xo = 0;
            var yo = 1;
            var zo = 2;
            if (axis === 0) {
                xo = 1;
                yo = 0;
                zo = 2;
            } else if (axis === 2) {
                xo = 0;
                yo = 2;
                zo = 1;
            }

            var i, x = 0;
            var theta;
            // Generate caps
            for (cap = -1; cap < 2; cap += 2) {
                for (i = 0; i < 40; i++) {
                    theta = 2 * Math.PI * (i / 40);
                    positions[x+xo] = radius * Math.cos(theta);
                    positions[x+yo] = cap * height * 0.5;
                    positions[x+zo] = radius * Math.sin(theta);
                    x += 3;

                    theta = 2 * Math.PI * ((i + 1) / 40);
                    positions[x+xo] = radius * Math.cos(theta);
                    positions[x+yo] = cap * height * 0.5;
                    positions[x+zo] = radius * Math.sin(theta);
                    x += 3;
                }

                for (i = 0; i < 20; i++) {
                    theta = Math.PI * (i / 20) + Math.PI * 1.5;
                    positions[x+xo] = 0;
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = cap * (radius * Math.sin(theta));
                    x += 3;

                    theta = Math.PI * ((i + 1) / 20) + Math.PI * 1.5;
                    positions[x+xo] = 0;
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = cap * (radius * Math.sin(theta));
                    x += 3;
                }

                for (i = 0; i < 20; i++) {
                    theta = Math.PI * (i / 20) + Math.PI * 1.5;
                    positions[x+xo] = cap * (radius * Math.sin(theta));
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = 0;
                    x += 3;

                    theta = Math.PI * ((i + 1) / 20) + Math.PI * 1.5;
                    positions[x+xo] = cap * (radius * Math.sin(theta));
                    positions[x+yo] = cap * (height * 0.5 + radius * Math.cos(theta));
                    positions[x+zo] = 0;
                    x += 3;
                }
            }

            // Connect caps
            for (i = 0; i < 4; i++) {
                theta = 2 * Math.PI * (i / 4);
                positions[x+xo] = radius * Math.cos(theta);
                positions[x+yo] = height * 0.5;
                positions[x+zo] = radius * Math.sin(theta);
                x += 3;

                theta = 2 * Math.PI * (i / 4);
                positions[x+xo] = radius * Math.cos(theta);
                positions[x+yo] = -height * 0.5;
                positions[x+zo] = radius * Math.sin(theta);
                x += 3;
            }

            vertexBuffer.unlock();
        },

        createPhysicalShape: function (entity, data) {
            var shape = null;
            var axis = (typeof data.axis !== 'undefined') ? data.axis : 1;
            var scale = this.getWorldScale(entity);
            var radius = this.getScaledRadius(data.radius, scale, axis);
            var height = this.getScaledHeight(data.height, scale, radius, axis);

            if (typeof(Ammo) !== 'undefined') {
                switch (axis) {
                    case 0:
                        shape = new Ammo.btCapsuleShapeX(radius, height);
                        break;
                    case 1:
                        shape = new Ammo.btCapsuleShape(radius, height);
                        break;
                    case 2:
                        shape = new Ammo.btCapsuleShapeZ(radius, height);
                        break;
                }
            }
            return shape;
        },

        updateDebugShape: function (entity, data) {
            var root = data.model.graph;
            root.setPosition(entity.getPosition());
            root.setRotation(entity.getRotation());
            root.setLocalScale(1, 1, 1);
        },

        recreatePhysicalShapes: function (component) {
            var model = component.data.model;
            if (model) {
                // get the vertex buffer for this collision shape. createDebugMesh
                // will return the existing mesh if one exists in this case
                var vertexBuffer = this.createDebugMesh(component.entity, component.data).mesh.vertexBuffer;
                this.updateCapsuleShape(component.entity, component.data, vertexBuffer);
                CollisionCapsuleSystemImpl._super.recreatePhysicalShapes.call(this, component);
            }
        },

        updateTransform: function(component, position, rotation, scale) {
            this.recreatePhysicalShapes(component);
            CollisionCapsuleSystemImpl._super.updateTransform.call(this, component, position, rotation, scale); 
        },
    });

    /**
    /* Cylinder Collision System
    */
    
    CollisionCylinderSystemImpl = function (system) {};

    CollisionCylinderSystemImpl = pc.inherits(CollisionCylinderSystemImpl, CollisionSystemImpl);

    CollisionCylinderSystemImpl.prototype = pc.extend(CollisionCylinderSystemImpl.prototype, {
        createDebugMesh: function (entity, data) {            
            if (data.model && data.model.meshInstances && data.model.meshInstances.length) {
                return data.model.meshInstances[0];
            } else {
                var gd = this.system.context.graphicsDevice;

                var format = new pc.gfx.VertexFormat(gd, [
                    { semantic: pc.gfx.SEMANTIC_POSITION, components: 3, type: pc.gfx.ELEMENTTYPE_FLOAT32 }
                ]);

                var vertexBuffer = new pc.gfx.VertexBuffer(gd, format, 168, pc.gfx.BUFFER_DYNAMIC);
                this.updateCylinderShape(entity, data, vertexBuffer);

                var mesh = new pc.scene.Mesh();
                mesh.vertexBuffer = vertexBuffer;
                mesh.primitive[0].type = pc.gfx.PRIMITIVE_LINES;
                mesh.primitive[0].base = 0;
                mesh.primitive[0].count = vertexBuffer.getNumVertices();
                mesh.primitive[0].indexed = false;

                if (!this.material) {
                    var material = new pc.scene.BasicMaterial();
                    material.color = pc.math.vec4.create(0, 0, 1, 1);
                    material.update();
                    this.material = material;    
                }

                return new pc.scene.MeshInstance(data.model.graph, mesh, this.material);
            }
        },

        /**
        * Scales the radius on all axes except the height axis and returns the 
        * max value between the axes and the original radius
        */
        getScaledRadius: function (radius, scale, axis) {
            radius = (typeof radius !== 'undefined' ? radius : 0.5);
            return Math.max(Math.max(radius, radius * scale[(axis+1)%3]), radius * scale[(axis+2)%3]);
        },

        getScaledHeight: function (height, scale, axis) {
            height = (typeof height != 'undefined' ? height : 1);
            return height * scale[axis];
        },

        updateCylinderShape: function(entity, data, vertexBuffer) {
            var axis = (typeof data.axis !== 'undefined') ? data.axis : 1;
            var scale = this.getWorldScale(entity);            
            var radius = this.getScaledRadius(data.radius, scale, axis);
            var height = this.getScaledHeight(data.height, scale, axis); 

            var positions = new Float32Array(vertexBuffer.lock());

            var xo = 0;
            var yo = 1;
            var zo = 2;
            if (axis === 0) {
                xo = 1;
                yo = 0;
                zo = 2;
            } else if (axis === 2) {
                xo = 0;
                yo = 2;
                zo = 1;
            }

            var i, x = 0;
            var theta;
            // Generate caps
            for (cap = -1; cap < 2; cap += 2) {
                for (i = 0; i < 40; i++) {
                    theta = 2 * Math.PI * (i / 40);
                    positions[x+xo] = radius * Math.cos(theta);
                    positions[x+yo] = cap * height * 0.5;
                    positions[x+zo] = radius * Math.sin(theta);
                    x += 3;

                    theta = 2 * Math.PI * ((i + 1) / 40);
                    positions[x+xo] = radius * Math.cos(theta);
                    positions[x+yo] = cap * height * 0.5;
                    positions[x+zo] = radius * Math.sin(theta);
                    x += 3;
                }
            }

            // Connect caps
            for (i = 0; i < 4; i++) {
                theta = 2 * Math.PI * (i / 4);
                positions[x+xo] = radius * Math.cos(theta);
                positions[x+yo] = height * 0.5;
                positions[x+zo] = radius * Math.sin(theta);
                x += 3;

                theta = 2 * Math.PI * (i / 4);
                positions[x+xo] = radius * Math.cos(theta);
                positions[x+yo] = -height * 0.5;
                positions[x+zo] = radius * Math.sin(theta);
                x += 3;
            }

            vertexBuffer.unlock();
        },

        createPhysicalShape: function (entity, data) {
            var halfExtents = null;
            var shape = null;
            var axis = (typeof data.axis !== 'undefined') ? data.axis : 1;
            var scale = this.getWorldScale(entity);            
            var radius = this.getScaledRadius(data.radius, scale, axis);
            var height = this.getScaledHeight(data.height, scale, axis); 

            if (typeof(Ammo) !== 'undefined') {
                switch (axis) {
                    case 0:
                        halfExtents = new Ammo.btVector3(height * 0.5, radius, radius);
                        shape = new Ammo.btCylinderShapeX(halfExtents);
                        break;
                    case 1:
                        halfExtents = new Ammo.btVector3(radius, height * 0.5, radius);
                        shape = new Ammo.btCylinderShape(halfExtents);
                        break;
                    case 2:
                        halfExtents = new Ammo.btVector3(radius, radius, height * 0.5);
                        shape = new Ammo.btCylinderShapeZ(halfExtents);
                        break;
                }
            }
            return shape;
        },

        updateDebugShape: function (entity, data) {
            var root = data.model.graph;
            root.setPosition(entity.getPosition());
            root.setRotation(entity.getRotation());
            root.setLocalScale(1, 1, 1);
        },

        updateTransform: function(component, position, rotation, scale) {
            this.recreatePhysicalShapes(component);
            CollisionCylinderSystemImpl._super.updateTransform.call(this, component, position, rotation, scale); 
        },

        recreatePhysicalShapes: function (component) {
            var model = component.data.model;
            if (model) {
                var vertexBuffer = this.createDebugMesh(component.entity, component.data).mesh.vertexBuffer;
                this.updateCylinderShape(component.entity, component.data, vertexBuffer);
                CollisionCylinderSystemImpl._super.recreatePhysicalShapes.call(this, component);
            }
        },
    });

    /**
    /* Mesh Collision System
    */
    
    CollisionMeshSystemImpl = function (system) {
        this.hasDebugShape = false;
    };

    CollisionMeshSystemImpl = pc.inherits(CollisionMeshSystemImpl, CollisionSystemImpl);

    CollisionMeshSystemImpl.prototype = pc.extend(CollisionMeshSystemImpl.prototype, {
        // override for the mesh implementation because the asset model needs
        // special handling
        beforeInitialize: function (component, data) {},

        createPhysicalShape: function (entity, data) {
            if (typeof(Ammo) !== 'undefined' && data.model) {
                var model = data.model;
                var shape = new Ammo.btCompoundShape();

                var i, j;
                for (i = 0; i < model.meshInstances.length; i++) {
                    var meshInstance = model.meshInstances[i];
                    var mesh = meshInstance.mesh;
                    var ib = mesh.indexBuffer[pc.scene.RENDERSTYLE_SOLID];
                    var vb = mesh.vertexBuffer;

                    var format = vb.getFormat();
                    var stride = format.size / 4;
                    var positions;
                    for (j = 0; j < format.elements.length; j++) {
                        var element = format.elements[j];
                        if (element.name === pc.gfx.SEMANTIC_POSITION) {
                            positions = new Float32Array(vb.lock(), element.offset);
                        }
                    }

                    var indices = new Uint16Array(ib.lock());
                    var numTriangles = mesh.primitive[0].count / 3;

                    var v1 = new Ammo.btVector3();
                    var v2 = new Ammo.btVector3();
                    var v3 = new Ammo.btVector3();
                    var i1, i2, i3;

                    var base = mesh.primitive[0].base;
                    var triMesh = new Ammo.btTriangleMesh();
                    for (j = 0; j < numTriangles; j++) {
                        i1 = indices[base+j*3] * stride;
                        i2 = indices[base+j*3+1] * stride;
                        i3 = indices[base+j*3+2] * stride;
                        v1.setValue(positions[i1], positions[i1 + 1], positions[i1 + 2]);
                        v2.setValue(positions[i2], positions[i2 + 1], positions[i2 + 2]);
                        v3.setValue(positions[i3], positions[i3 + 1], positions[i3 + 2]);
                        triMesh.addTriangle(v1, v2, v3, true);
                    }

                    var useQuantizedAabbCompression = true;
                    var triMeshShape = new Ammo.btBvhTriangleMeshShape(triMesh, useQuantizedAabbCompression);

                    var scl = this.getWorldScale(meshInstance.node);
                    triMeshShape.setLocalScaling(new Ammo.btVector3(scl[0], scl[1], scl[2]));

                    var position = meshInstance.node.getPosition();
                    var rotation = meshInstance.node.getRotation();

                    var transform = new Ammo.btTransform();
                    transform.setIdentity();
                    transform.getOrigin().setValue(position[0], position[1], position[2]);

                    var ammoQuat = new Ammo.btQuaternion();
                    ammoQuat.setValue(rotation[0], rotation[1], rotation[2], rotation[3]);
                    transform.setRotation(ammoQuat);

                    shape.addChildShape(transform, triMeshShape);
                }

                var scale = this.getWorldScale(entity);
                var vec = new Ammo.btVector3();
                vec.setValue(scale[0], scale[1], scale[2]);
                shape.setLocalScaling(vec);

                return shape;
            } else {
                return undefined;
            }
        },

        recreatePhysicalShapes: function (component) {
            var data = component.data;

            if (data.asset) {
                this.loadModelAsset(component);
            } else {
                data.model = null;
                this.doRecreatePhysicalShape(component);
            }
        },

        loadModelAsset: function(component) {
            var guid = component.data.asset;
            var entity = component.entity;
            var data = component.data;

            var options = {
                parent: entity.getRequest()
            };

            var asset = this.system.context.assets.getAssetByResourceId(guid);
            if (!asset) {
                logERROR(pc.string.format('Trying to load model before asset {0} is loaded.', guid));
                return;
            }

            this.system.context.assets.load(asset, [], options).then(function (resources) {
                var model = resources[0];
                data.model = model;
                this.doRecreatePhysicalShape(component);

            }.bind(this));
        },

        doRecreatePhysicalShape: function (component) {
            var entity = component.entity;
            var data = component.data;

            if (data.model) {
                if (data.shape) {
                   Ammo.destroy(data.shape);
                }

                data.shape = this.createPhysicalShape(entity, data);                

                if (entity.rigidbody) {
                    entity.rigidbody.createBody();
                } else {
                    if (!entity.trigger) {
                        entity.trigger = new pc.fw.Trigger(this.system.context, component, data);
                    }

                    entity.trigger.initialize(data);
                } 
            } else {
                this.remove(entity, data);
            }
             
        },

        updateTransform: function(component, position, rotation, scale) {
            if (component.shape) {
                var worldScale = this.getWorldScale(component.entity);

                // if the scale changed then recreate the shape
                var previousScale = component.shape.getLocalScaling();                
                if (worldScale[0] != previousScale.x() ||
                    worldScale[1] != previousScale.y() ||
                    worldScale[2] != previousScale.z() ) {
                    this.doRecreatePhysicalShape(component);
                }
            }

            CollisionMeshSystemImpl._super.updateTransform.call(this, component, position, rotation, scale);
        }
        
    });

    return {
        CollisionComponentSystem: CollisionComponentSystem
    };
}());