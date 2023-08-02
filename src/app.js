//app.js
//引入mqtt包
import aedes from "aedes";
//网络服务包，nodejs自带
import net from "net";

//引入持久化包
import aedesPersistenceMongoDB from "aedes-persistence-mongodb";

//创建aedes实例
/*
	配置项: mq: 消息队列，用于存储和处理消息。默认情况下，aedes 使用内存消息队列，但你可以使用其他消息队列实现，例如 Redis。
            id: 服务器的唯一标识符。如果未指定，则将自动生成一个唯一标识符。
            persistence: 持久化存储，用于将连接和会话状态存储到磁盘或数据库中。默认情况下，aedes 使用内存持久化存储，但你可以使用其他持久化存储实现，例如 LevelDB 或 MongoDB。
            concurrency: 最大并发连接数。默认情况下，aedes 允许无限制的并发连接。
            heartbeatInterval: 心跳间隔时间，用于检测连接是否处于活动状态。默认情况下，aedes 每 5 分钟发送一次心跳包。
            connectTimeout: 连接超时时间。默认情况下，aedes 允许无限制的连接超时时间。
            queueLimit: 消息队列长度限制，用于限制消息队列的最大长度。默认情况下，aedes 不限制消息队列长度。
            maxClientsIdLength: 最大客户端 ID 长度。默认情况下，aedes 允许客户端 ID 的最大长度为 23 个字符。
            preConnect: 在连接建立之前执行的处理程序。可以用于验证客户端的身份或执行其他预处理操作。
            authenticate: 身份验证处理程序，用于验证客户端的身份。可以使用用户名/密码、证书等进行身份验证。
            authorizePublish: 发布授权处理程序，用于授权客户端发布消息。
            authorizeSubscribe: 订阅授权处理程序，用于授权客户端订阅主题。
            authorizeForward: 转发授权处理程序，用于授权客户端转发消息。
            published: 发布处理程序，用于在消息发布后执行自定义操作，例如记录日志或触发事件。
*/
//持久化
const persistence = aedesPersistenceMongoDB({
    url: "mongodb://127.0.0.1/aedes-test", // Optional when you pass db object
    // Optional mongo options
    // mongoOptions: {
    //     auth: {
    //         user: "",
    //         password: "",
    //     },
    // },
    // Optional ttl settings
    ttl: {
        packets: 300, // Number of seconds
        subscriptions: 300,
    },
});

//我只用到三个配置项，其他配置项有需要可以自行配置
export const aedesApp = new aedes({
    persistence: persistence, //持久化
    heartbeatInterval: 60000, //60s发送一次心跳包
    connectTimeout: 120000, //如果与服务器120s没有收到连接客户端发过来的心跳包，则视为连接断开
});

//验证账号密码
aedesApp.authenticate = async function (client, username, password, callback) {
    //client.id是客户端的id，是唯一的，username是客户端的用户名（密码为buffer，需要转化为string），password是客户端的密码
    //我们可以在这里进行用户的身份验证，是否允许客户端的这次连接请求
    const newPassword = password.toString();
    if (username === "admin" && newPassword === "123456") {
        callback(null, true); //callback函数需要传递两个参数，第一个是错误实例，第二个是是否同意连接
    } else {
        callback(null, false);
    }
};

//监听MQTT服务器端口，当有客户端连接上时，触发该回调
aedesApp.on("client", async (client) => {
    console.log("ClientConnect:", client.id);
});

//监听MQTT服务器端口，当有客户端主动断开连接或者服务器120s内没收到某个客户端的心跳包就会触发该回调
aedesApp.on("clientDisconnect", async (client) => {
    console.log("clientDisconnect:", client.id);
});

//订阅主题。该函数第一个参数是要订阅的主题； 第二个是用于处理收到的消息的函，它接受两个参数：packet 和 callback。packet 是一个 AedesPublishPacket 对象，表示收到的消息；callback 是一个函数，用于在消息处理完成后通知 aedes 服务器；第三个参数是订阅成功的回调函数
aedesApp.subscribe(
    "myMsg",
    async function (packet, callback) {
        callback();
    },
    () => {
        console.log("订阅myMsg成功");
        // 添加订阅信息到数据库
        persistence.addSubscriptions(clientId, ["myTopic"], (err) => {
            if (err) {
                console.error("Failed to add subscription:", err);
            }
        });
    }
);

//处理收到的消息,我们订阅所有主题收到的消息都可以通过这个事件获取(我们可以把订阅收到消息的处理函数写在上面订阅主题函数的第二个参数里面，或者统一写在下面)
aedesApp.on("publish", async function (packet, client) {
    //packet.topic表示哪个主题，packet.payload是收到的数据，是一串二进制数据，我们需要用.toString()将它转化为字符串
    if (packet.topic === "myMsg") {
        console.log("Received message:", packet.payload.toString());
        // 存储保留消息
        persistence.storeRetained(packet, (err) => {
            if (err) {
                console.error("Failed to store retained message:", err);
            }
        });
    }
});

//发布主题
setInterval(() => {
    //两秒发布一次
    aedesApp.publish(
        {
            topic: "success", //发布主题
            payload: "yes", //消息内容
            qos: 1, //MQTT消息的服务质量（quality of service）。服务质量是1，这意味着这个消息需要至少一次确认（ACK）才能被认为是传输成功
            retain: false, // MQTT消息的保留标志（retain flag），它用于控制消息是否应该被保留在MQTT服务器上，以便新的订阅者可以接收到它。保留标志是false，这意味着这个消息不应该被保留
            cmd: "publish", // MQTT消息的命令（command），它用于控制消息的类型。命令是"publish"，这意味着这个消息是一个发布消息
            dup: false, //判断消息是否是重复的
        },
        (err) => {
            //发布失败的回调
            if (err) {
                console.log("发布失败");
            } else {
                // 将消息放入发送队列
                persistence.outgoingEnqueue(client, packet, (err) => {
                    if (err) {
                        console.error(
                            "Failed to enqueue outgoing message:",
                            err
                        );
                    }
                });
            }
        }
    );
}, 2000);

//创建服务器
const server = net.createServer(aedesApp.handle);
// 运行服务器,运行在1883端口
server.listen(1883, function () {
    console.log("server started and listening on port 1883");
});
