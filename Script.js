// 蓝牙设备提供的服务的 UUIDs
//加速度传感器服务
ACCELEROMETER_SERVICE = "e95d0753-251d-470a-a062-fa1922dfa9a8";
//LED服务
LED_SERVICE = "e95dd91d-251d-470a-a062-fa1922dfa9a8";
//设备信息服务
DEVICE_INFORMATION_SERVICE = "0000180a-0000-1000-8000-00805f9b34fb";

// characteristic（特性） UUIDs
ACCELEROMETER_DATA = "e95dca4b-251d-470a-a062-fa1922dfa9a8";
LED_MATRIX_STATE = "e95d7b77-251d-470a-a062-fa1922dfa9a8";
MODEL_NUMBER_STRING = "00002a24-0000-1000-8000-00805f9b34fb";

//设备抽象
var Connected_Device;
//连接状态
var Connected_Server;
var Connected = false;
//服务是否存在
var LED_ServiceV = false;
var ACCELEROMETER_ServiceV = false;
var DEVICE_INFORMATION_ServiceV = false;

//特性
//LED是否可用
var LED_State;
var LED_Ready = false;
//读取设备信息字符串是否可用
var MODEL_NUMBER_STRING_State;
var MODEL_NUMBER_STRING_Ready = false;
//加速度计是否可用
var ACCELEROMETER_DATA_State;
var ACCELEROMETER_DATA_Ready = false;

//连接设备或断开连接
function DiscoveOrDisConnect() {
    if (Connected) {
        Connected_Device.gatt.disconnect();
        console.log("===>用户断开了连接<===")
        UpdateUI();
    }
    else {
        DiscoverDevice();
        UpdateUI();
    }
}

//发现蓝牙设备
function DiscoverDevice() {
    //过滤出我们需要的蓝牙设备
    //过滤器
    var options = {
        filters: [{ namePrefix: 'BBC' }],
        optionalServices: [DEVICE_INFORMATION_SERVICE,
            ACCELEROMETER_SERVICE, LED_SERVICE]
    };

    navigator.bluetooth.requestDevice(options)
        .then(device => {
            console.log('> 设备名称: ' + device.name);
            console.log('> 设备Id: ' + device.id);
            console.log('> 是否已连接到其它设备: ' + device.gatt.connected);
            //连接到该设备
            Connected_Device = device;
            ConnectDevice();
        })
        .catch(error => {
            alert('出现错误: ' + error);
            console.log('=> 出现错误: ' + error);
        });
}

//连接到蓝牙设备
function ConnectDevice() {
    Connected_Device.gatt.connect().then(
        function (server) {
            console.log("> 连接到GATT服务器：" + server.device.id);
            console.log("> 连接成功=" + server.connected);
            //更新UI的信息
            Connected = true;
            UpdateUI();
            //将Server赋给全局变量（已连接的GATT服务器
            Connected_Server = server;

            //监听连接断开事件
            Connected_Device.addEventListener('gattserverdisconnected', function () {
                Connected = false;
                UpdateUI();
            });
            //发现GATT服务器的特性
            DiscoverService();
        },
        function (error) {
            console.log("=> 错误: 无法连接 - " + error);
            alert("错误: 无法连接 - " + error);
            Connected = false;
            UpdateUI();
        });
}

//发现蓝牙设备的服务和特性
function DiscoverService() {
    console.log("> 正在服务器发现可用的服务与特性......\n> 服务器：" + Connected_Server);

    //已发现的服务
    let ServicesDiscovered = 0;

    Connected_Server.getPrimaryServices()
        .then(Services => {

            //服务总数
            let ServiceSum = Services.length;
            console.log("> 发现服务数量：" + ServiceSum);

            Services.forEach(service => {
                //是否存在加速度计服务
                if (service.uuid == ACCELEROMETER_SERVICE) {
                    ACCELEROMETER_ServiceV = true;
                }
                //是否存在LED服务
                if (service.uuid == LED_SERVICE) {
                    LED_ServiceV = true;
                }
                //是否存在设备信息服务
                if (service.uuid == DEVICE_INFORMATION_SERVICE) {
                    DEVICE_INFORMATION_ServiceV = true;
                }
                console.log("> 获取到服务的特性(UUID)：" + service.uuid);

                service.getCharacteristics().then(Characteristics => {
                    console.log("> 服务: " + service.uuid);
                    ServicesDiscovered++;

                    //已发现的特性
                    let CharacteristicsDiscovered = 0;
                    //所有的特性
                    let CharacteristicsSum = Characteristics.length;

                    Characteristics.forEach(Characteristic => {
                        CharacteristicsDiscovered++; console.log('>> 特性(UUID): ' + Characteristic.uuid);
                        if (Characteristic.uuid == ACCELEROMETER_DATA) {
                            //加速度计特性存在
                            ACCELEROMETER_DATA_State = Characteristic;
                            ACCELEROMETER_DATA_Ready = true;
                        }
                        if (Characteristic.uuid == LED_MATRIX_STATE) {
                            //LED特性存在
                            //将特性赋给全局变量，以修改LED矩阵的状态
                            LED_State = Characteristic;
                            LED_Ready = true;
                        }
                        if (Characteristic.uuid == MODEL_NUMBER_STRING) {
                            //设备型号字符串特性存在
                            MODEL_NUMBER_STRING_State = Characteristic;
                            MODEL_NUMBER_STRING_Ready = true;
                        }
                        if (ServicesDiscovered == ServiceSum && CharacteristicsDiscovered == CharacteristicsSum) {
                            console.log("===>服务搜索完成<===");
                            //更新UI的信息
                            UpdateUI();
                            //读取设备型号
                            ReadModelStr();
                            //实时更新加速度计的数据
                            ShwoAcceleration();
                        }
                    });

                });
            });
        });
}

//初始化用户界面
function InitUI() {
    let leds = document.getElementById("leds");
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {

            leds.rows[i].cells[j].setAttribute("stat", 0);
            leds.rows[i].cells[j].onclick = function () {
                if (LED_Ready == false) {
                    alert("LED不可用");
                    return;
                }
                let stat = this.getAttribute("stat");
                if (stat == 0) {
                    this.setAttribute("stat", 1);
                    this.style.background = "#fa5a5a";
                }
                else if (stat == 1) {
                    this.setAttribute("stat", 0);
                    this.style.background = "#DCDCDC";
                }

                ChangeLED();
            };
        }
    }
}

//处理用户修改LED
//五位：16 8 4 2 1
function ChangeLED() {
    let leds = document.getElementById("leds");
    var led_array = [0, 0, 0, 0, 0];
    for (let i = 0; i < 5; i++) {
        let v = 16;
        for (let j = 0; j < 5; j++) {
            led_array[i] += (leds.rows[i].cells[j].getAttribute("stat") * v);
            v /= 2;
        }
    }
    console.log(led_array);
    let LED_Data = new Uint8Array(led_array);
    LED_State.writeValue(LED_Data.buffer)
        .then(Log => {
            console.log("> LED 矩阵状态已修改");
        })
        .catch(error => {
            console.log("> 出现错误：" + error);
            alert("出现错误：" + error);
            return;
        });
}

//读取设备型号字符串
function ReadModelStr() {
    MODEL_NUMBER_STRING_State.readValue()
        .then(value => {
            data = new Uint8Array(value.buffer);
            let Str = new TextDecoder("utf-8").decode(data);
            document.getElementById("UI_DeviceType").innerHTML = "设备类型：" + Str;
        })
        .catch(error => {
            console.log("出现错误: " + error);
            alert("出现错误: " + error);
            return;
        });
}

//实时显示加速度计的数据
function ShwoAcceleration() {
    //通过添加监听加速度计的值改变事件来实现
    if (ACCELEROMETER_DATA_Ready) {
        ACCELEROMETER_DATA_State.startNotifications()
            .then(_ => {
                console.log("> 加速度计值显示已启用");
                ACCELEROMETER_DATA_State.addEventListener('characteristicvaluechanged', _ => {
                    let buffer = event.target.value.buffer;
                    dataview = new DataView(buffer);
                    let X = dataview.getUint16(0, true);
                    let Y = dataview.getUint16(2, true);
                    let Z = dataview.getUint16(4, true);
                    document.getElementById("Acceleration_V").innerHTML = "X=" + X + " Y=" + Y + " Z=" + Z;
                });
            })
            .catch(error => {
                console.log("出现错误：" + error);
                alert("出现错误：" + error);
                return;
            });
    }
    else {
        console.log("> 出现异常：加速度计服务不可用");
        return;
    }
}

//更新UI
function UpdateUI() {
    //是否已连接
    if (Connected) {
        document.getElementById("UI_Connected").innerHTML = "连接状态：已连接";
        document.getElementById("MBtn").innerHTML = "断开";
    }
    else {
        document.getElementById("UI_Connected").innerHTML = "连接状态：未连接";
        document.getElementById("UI_DeviceType").innerHTML = "设备类型：未知"
        document.getElementById("MBtn").innerHTML = "连接";
        LED_Ready = false;
        ACCELEROMETER_DATA_Ready = false;
        MODEL_NUMBER_STRING_Ready = false;
    }
    //LED是否就绪
    if (LED_Ready) {
        document.getElementById("led_stat").innerHTML = "就绪";
        document.getElementById("led_stat").style.color = "#00cc75";
    }
    else {
        document.getElementById("led_stat").innerHTML = "不可用";
        document.getElementById("led_stat").style.color = "#FF0000";
        let leds = document.getElementById("leds");
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 5; j++) {
                leds.rows[i].cells[j].setAttribute("stat", 0);
                leds.rows[i].cells[j].style.background = "#DCDCDC";
            }
        }
    }
    //加速度计是否就绪
    if (ACCELEROMETER_DATA_Ready) {
        document.getElementById("acceleration_stat").innerHTML="就绪";
        document.getElementById("acceleration_stat").style.color = "#00cc75";
    }
    else {
        document.getElementById("acceleration_stat").innerHTML = "不可用";
        document.getElementById("acceleration_stat").style.color = "#FF0000";
        document.getElementById("Acceleration_V").innerHTML="X=0 Y=0 Z=0";
    }
    //设备类型是否就绪
    if (MODEL_NUMBER_STRING_Ready) {

    }
    else {

    }
}

InitUI();