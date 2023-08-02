import mqtt from "mqtt";

//连接到 MQTT 服务器
const client = mqtt.connect("mqtt://localhost",{
  username:'admin',   //用户名
  password:'123456',  //密码
  clientId: '1',      //客户端id
});

//订阅主题
client.on("connect", function () {
  client.subscribe("esp32/test", function (err) {
    if (!err) {
      console.log("Subscribed to success");
    }
  });
});

//处理收到的消息
client.on("message", function (topic, message) {
  if (topic === "esp32/test") {
    console.log("Received message:", message.toString());
  }
});
//发布消息
setInterval(() => {
  client.publish("myMsg", '123123');
}, 2000);
