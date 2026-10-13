// [诊断] console.log 计数器。目的只有一个：区分「log 没被调用」和
// 「调用了但没送达宿主」。现场症状是 setTimeout 回调里 setupFn 内部的
// console.log 能到、函数返回后的 Hook setup complete 到不了，两种解释
// 都能解释这个现象，必须用计数拆开，否则只能靠猜。
var __zmybotNativeLog = console.log;
var __zmybotConsoleCalls = 0;
console.log = function () {
    __zmybotConsoleCalls += 1;
    // 运行日志只保留注入结果、错误和真实业务事件。周期诊断心跳由脚本自己
    // 产生，既不能证明收包成功，又会把运行日志淹没；旧版本还会带 logCalls。
    try {
        var quietText = Array.prototype.slice.call(arguments).map(function (v) {
            return String(v);
        }).join(" ");
        if (/heartbeat|心跳|logCalls|保活|收包计数变化/i.test(quietText)) return;
    } catch (_) {}
    return __zmybotNativeLog.apply(console, arguments);
};
var targetPath = "/Applications/WeChat.app/Contents/Resources/wechat.dylib";
var module = Process.enumerateModules().find(function(m) {
    return m.path === targetPath;
});
if (!module) {
    throw new Error("[-] Cannot find module: " + targetPath);
}
var baseAddr = module.base;
console.log("[+] WeChat resource dylib base: " + baseAddr);
// [已删除 hook 档位] 2026-09-30：原先这里有 HOOK_PROFILE + ENABLE_RECEIVE/TEXT/MEDIA/
// UPDATE_GUARD 四个开关，由 Rust 侧 HookFlags::parse 按 --hook-profile 档位渲染。
// 档位机制整体删除：能力分组只作为下面 scheduleHook 的注释分组保留，不再有开关。
// 例外是 ENABLE_UPDATE_GUARD —— 它由 --block-wechat-update 驱动，是用户策略开关。
// 起因是桌面端 OneBotRuntime.swift 硬编码 --hook-profile safe，导致媒体上传整组
// （4 个 Interceptor + 2 个 dynamic setup）在实际产品里从未注入过，而开关却显示已开。
// 更新守卫是**用户策略开关**（桌面端「禁止微信强制更新」勾选框 -> --block-wechat-update），
// 不是能力档位，所以档位删除后它依然保留为模板开关。默认 true。
const ENABLE_UPDATE_GUARD = {{.EnableUpdateGuard}};
// [已删除 download hook] ENABLE_DOWNLOAD_HOOKS 常量移除。
// 依赖链：Rust 侧 crates/zmybot/src/script_render.rs 注入 {{.EnableDownloadHooks}} ->
// script.js 装载 downloadImagAddr / startDownloadMedia / downloadFileAddr / downloadVideoAddr
// 四个偏移 -> setReceiver 内挂 3 个 Interceptor 捕获下载字节 -> sendDownloadChunks 发
// {type:"download"} -> Rust 侧零消费方（rg "download" 于 zmybot-rs/crates 无任何匹配），
// 且 triggerDownload 在 Rust 侧引用数为 0。整条链路无出口，故整体删除。
const SPOOF_WECHAT_VERSION = {{.SpoofWeChatVersion}};
const REPORTED_FULL_VERSION = "{{.ReportedFullVersion}}";
const REPORTED_SHORT_VERSION = "{{.ReportedShortVersion}}";
const REPORTED_PATCH_VERSION = "{{.ReportedPatchVersion}}";
const REPORTED_BUNDLE_VERSION = "{{.ReportedBundleVersion}}";
const LOCAL_FULL_VERSION = "{{.LocalFullVersion}}";
const LOCAL_SHORT_VERSION = "{{.LocalShortVersion}}";
const LOCAL_PATCH_VERSION = "{{.LocalPatchVersion}}";
const LOCAL_BUNDLE_VERSION = "{{.LocalBundleVersion}}";
const MAX_RECV_PROTOBUF_BYTES = 256 * 1024;
const MAX_BUF2RESP_BYTES = 128 * 1024;
// 往微信内部 StartTask 载荷里写的 proto 字节上限。载荷结构体本身至少要 0x198 字节，
// 实际 proto 通常几 KB；给到 64KB 已经很宽松，再大基本是上游构造出错而不是正常消息。
const MAX_SEND_PAYLOAD_BYTES = 64 * 1024;
const CONFIGURED_HOOK_OFFSETS = {
    blrX8Addr: "{{.blrX8Addr}}",
    autoBufferWriteFunc: "{{.autoBufferWriteFunc}}",
    req2bufEnterAddr: "{{.req2bufEnterAddr}}",
    req2bufExitAddr: "{{.req2bufExitAddr}}",
    sendFuncAddr: "{{.sendFuncAddr}}",
    buf2RespAddr: "{{.buf2RespAddr}}",
    uploadImageAddr: "{{.uploadImageAddr}}",
    cndOnCompleteAddr: "{{.cndOnCompleteAddr}}",
    uploadGetCallbackWrapperAddr: "{{.uploadGetCallbackWrapperAddr}}",
    uploadGetCallbackWrapperFuncAddr: "{{.uploadGetCallbackWrapperFuncAddr}}",
    uploadOnCompleteAddr: "{{.uploadOnCompleteAddr}}",
    uploadOnCompleteFuncAddr: "{{.uploadOnCompleteFuncAddr}}",
    profileReaderAddr: "{{.profileReaderAddr}}"
};
const HOOK_ENTRY_BYTES = {
    profileReaderAddr: "{{.profileReaderAddrEntryBytes}}",
    buf2RespAddr: "{{.buf2RespAddrEntryBytes}}",
    blrX8Addr: "{{.blrX8AddrEntryBytes}}",
    autoBufferWriteFunc: "{{.autoBufferWriteFuncEntryBytes}}",
    req2bufEnterAddr: "{{.req2bufEnterAddrEntryBytes}}",
    req2bufExitAddr: "{{.req2bufExitAddrEntryBytes}}",
    sendFuncAddr: "{{.sendFuncAddrEntryBytes}}",
    uploadImageAddr: "{{.uploadImageAddrEntryBytes}}",
    cndOnCompleteAddr: "{{.cndOnCompleteAddrEntryBytes}}",
    uploadGetCallbackWrapperAddr: "{{.uploadGetCallbackWrapperAddrEntryBytes}}",
    uploadGetCallbackWrapperFuncAddr: "{{.uploadGetCallbackWrapperFuncAddrEntryBytes}}",
    uploadOnCompleteFuncAddr: "{{.uploadOnCompleteFuncAddrEntryBytes}}",
    uploadOnCompleteAddr: "{{.uploadOnCompleteAddrEntryBytes}}"
};
// 核心必需偏移：缺任何一个，这个注入就没有意义，整体拒绝。
//
// 判据是「机器人还能不能干活」：
//   · profileReaderAddr —— 拿不到账号信息（wxid/nickname/phone），实例建不起来
//   · buf2RespAddr / blrX8Addr / autoBufferWriteFunc / req2buf* —— 收不到任何消息
// 不在这张表里的（sendFuncAddr、媒体上传那组）缺失只降级：还能收消息、
// 只是发不出去或发不了图。整体拒绝反而更糟 —— 用户什么都拿不到。
var MANDATORY_HOOK_OFFSETS = [
    "profileReaderAddr",
    "buf2RespAddr",
    "blrX8Addr",
    "autoBufferWriteFunc",
    "req2bufEnterAddr",
    "req2bufExitAddr"
];
// 内存扫描兜底：实测证明它在 4.1.12.53 上既慢又读不到东西，所以保持关闭。
// 2026-10-01 在已登录稳定的 WeChat（pid 24012）上实测：
//   - 扫 "/xwechat_files/wxid_" 找登录账号：1.6s，0 命中；
//   - 全可写内存扫 wxid：16.1s，命中 23 处，但全是 wxid 字符串副本
//     （间隔 0x40 重复），±0x100 字节内没有昵称/别名/手机号；
//   - >128MB 的区全是 r--/r-x 映射，故可写内存是 100% 覆盖的。
// 结论：这条兜底永远走不到返回点，却会在 2s 轮询里反复烧十几秒。
// 代码保留仅为将来重新逆向后的可复用性；没实测前不要改成 true。
const ENABLE_PROFILE_MEMORY_FALLBACK = false;
const HOOK_SCAN_PATTERNS = {
    cndOnCompleteAddr: { pattern: "68 42 00 91 29 00 80 52 08 01 29 F8 88 12 40 B9", adjust: 0xCC },
    uploadGetCallbackWrapperAddr: { pattern: "08 09 40 F9 E1 03 15 AA E2 03 14 AA E3 03 13 AA 00 01 3F D6 F3 07 40 F9 B3 00 00 B4", adjust: 0x00 },
    req2bufEnterAddr: { pattern: "09 0F 46 F8 C9 01 00 B4 E8 03 18 AA 2A 21 40 B9", adjust: 0x00 },
    uploadImageAddr: { pattern: "08 01 40 F9 A8 83 1A F8 28 9C 40 B9 1F 0D 00 71", adjust: 0x30 },
    sendFuncAddr: { pattern: "E0 03 00 91 21 00 80 52 E5 03 03 AA 46 8A 80 52", adjust: 0x44 },
    buf2RespAddr: { pattern: "E8 DF C1 39 28 E6 FF 36 E0 33 40 F9 E8 3B 40 F9", adjust: 0x14 },
    profileReaderAddr: { pattern: "FF C3 00 D1 F4 4F 01 A9 FD 7B 02 A9 FD 83 00 91 F3 03 08 AA ?? ?? ?? ?? ?? ?? ?? ?? 08 00 40 F9 09 35 40 F9", adjust: 0x00 }
};
// -------------------------钩子递归防护 / 熔断-------------------------
// 2026-09-30 崩溃复盘（WeChat 4.1.12 pid 50659）：
//   EXC_BAD_ACCESS(SIGILL) / KERN_PROTECTION_FAILURE at 0x301387fa0，
//   该地址正落在 thread 99 的 16K Stack Guard（301384000-301388000）里，
//   而 sp=0x301387f60 已越过 544K 栈顶 160 字节 —— 栈溢出，不是野指针。
//   崩溃线程 gum-js-loop（Frida 的 JS 执行线程），栈上是 156 层同构帧，
//   每层 6 帧、返回地址等距递增 —— 教科书式的「钩子回调里又触发被钩函数」无界递归。
//
// 为什么必须在这里拦：递归一旦成环，A 的 onEnter 调 B、B 的 onEnter 又回到 A，
// JS 侧没有任何 API 能打断它，进程只能吃栈溢出。所以护栏的目标不是「修好递归」，
// 而是把无界递归截断成有界：超过 MAX_DEPTH 的层直接放行原实现，函数正常返回。
//
// 三道防线：
//   1. 深度闸：所有钩子回调统一 enterHook/leaveHook，depth >= MAX_DEPTH 直接 return。
//      这是止损的那一刀 —— 递归被砍到 MAX_DEPTH 层，微信照常跑完这次调用。
//   2. 熔断自愈：同一 tag 连续触发 MAX_TRIPS 次就永久 detach 该钩子并上报 hook_guard。
//      宁可少一个能力，也不能让微信反复崩；上报后桌面端日志能直接看到是哪一个。
//
// 为什么用全局计数而不是 Thread.backtrace 之类的线程局部量：
// Frida 的 NativeCallback 和 Interceptor 回调都要抢同一把 JS 锁，实际执行是串行的，
// 全局计数等价于同线程计数，检测递归足够，而且零 API 成本。
var HOOK_MAX_DEPTH = 3;
var HOOK_MAX_TRIPS = 2;
globalThis.__zmybotHookDepth = 0;
globalThis.__zmybotHookGuard = {};      // tag -> { trips: number, disabled: bool }
globalThis.__zmybotHookListeners = {};  // tag -> InterceptorListener
// ObjC 方法替换登记表：method 指针 -> 原 IMP。
// 2026-09-30 崩溃复盘（WeChat 4.1.12 pid 62582, 18:10:30）：
//   EXC_BAD_ACCESS(SIGSEGV) / KERN_INVALID_ADDRESS at 0x111dc4040。
//   pc 前后是「Memory Tag 255 [16K] rw-/rwx」+「GAP OF 0x3c000」——
//   Tag 255 正是 NativeCallback 的代码页，该页已被 munmap，pc 是个纯悬空地址。
//   lr 精确落在 Foundation 的 _NSGetBoolValueWithMethod +76（0x18b00aa3c），
//   即 valueForKey: 读取 BOOL 型 KVC 属性的必经路径 —— objc_msgSend 从
//   method 表取到了指向已释放 trampoline 的 IMP。
//   而本脚本 9 个替换（7 封堵 + 2 版本伪装）里唯一返回 BOOL 的就是 XAppUpdateManager 的
//   canCheckForUpdate：微信二进制里它带 ivar 元数据（_canCheckForUpdate），
//   说明是可 KVC 读取的存储属性，Sparkle 侧又有对应的 KVO 观察者。
//   KVO 通知链一路级联到 valueForKey: 读它 → 跳飞。
//   根因：installWeChatUpdateGuard 用 method_setImplementation 替换了 9 个方法，
//   而 releaseRegisteredHooks() 只 detach Interceptor，从不还原 IMP。
//   脚本一旦 unload（正常退出、BYE 帧、甚至测试壳强杀 python），
//   code page 先消失，微信再调这些方法就是必崩 —— 与调用者是谁无关，
//   KVO 只是恰好第一个撞上的。
globalThis.__zmybotObjcImpls = [];    // [{ method, oldImpl, tag }]
globalThis.__zmybotReleased = false;  // zmybotRelease 幂等闸

// 导出符号解析的 Frida 17 兼容层。
//
// 2026-09-30 实机抓到的一个隐性失效：`Module.findExportByName` 在 Frida 17 里
// 已被移除，调用它直接抛 TypeError。installQuitRelease 原来就靠它解析 exit/_exit/
// objc_getClass，异常又被 `catch (e) {}` 吞掉 —— 结果是**三个退出卸钩从来没挂上过**，
// 日志里只有一行「退出卸钩未挂上」，平时根本不会注意到。微信退出时钩子不会主动卸，
// 只能等进程消亡，退出瞬间的注入面处于不确定状态。
// 现在统一走这里，找不到就明确抛错并在日志里点名，不再静默跳过。
function findExportCompat(name) {
    var p = null;
    try {
        if (typeof Module.getGlobalExportByName === "function") {
            p = Module.getGlobalExportByName(name);
        }
    } catch (e1) {}
    if ((!p || p.isNull()) && typeof Module.findExportByName === "function") {
        try { p = Module.findExportByName(null, name); } catch (e2) {}
    }
    if (!p || p.isNull()) {
        throw new Error("export missing: " + name);
    }
    return p;
}

// 登记钩子句柄，供熔断时精确 detach（不再用 Interceptor.detachAll 全局清盘）。
function registerHookListener(tag, listener) {
    globalThis.__zmybotHookListeners[tag] = listener;
    return listener;
}

// 钩子回调入口。返回 false 表示「本次调用放行原实现，不要跑任何 JS 逻辑」。
function enterHook(tag) {
    var depth = globalThis.__zmybotHookDepth;
    if (depth >= HOOK_MAX_DEPTH) {
        tripHookGuard(tag, depth);
        return false;
    }
    globalThis.__zmybotHookDepth = depth + 1;
    return true;
}

function leaveHook() {
    globalThis.__zmybotHookDepth = Math.max(0, globalThis.__zmybotHookDepth - 1);
}

// 递归命中计数 + 到量熔断。detach 必须延后到 JS 线程空闲时点：
// 当前正站在这个钩子自己的 trampoline 里同步 detach 是未定义行为。
function tripHookGuard(tag, depth) {
    var g = globalThis.__zmybotHookGuard[tag];
    // 已熔断的 tag 走最短路：否则每次进入都会再走一遍计数 + Date.now()，
    // 在热路径上等于把护栏本身变成新的开销来源。
    if (g && g.disabled) {
        return;
    }
    if (!g) {
        g = { trips: 0, disabled: false, first_at: Date.now(), last_depth: depth };
        globalThis.__zmybotHookGuard[tag] = g;
    }
    g.trips++;
    g.last_depth = depth;
    g.last_at = Date.now();
    if (g.trips < HOOK_MAX_TRIPS) {
        return;
    }
    g.disabled = true;
    var listener = globalThis.__zmybotHookListeners[tag];
    if (listener) {
        setTimeout(function () {
            try {
                listener.detach();
                Interceptor.flush();
                console.error("[!] 钩子熔断已摘除: " + tag);
            } catch (e) {
                console.error("[!] 钩子熔断摘除失败 " + tag + ": " + e);
            }
        }, 0);
    }
    try {
        send({
            type: "hook_guard",
            hook: tag,
            action: "detached",
            trips: g.trips,
            last_depth: g.last_depth,
            first_at: g.first_at,
            last_at: g.last_at,
            pid: Process.id
        });
    } catch (e2) {}
    console.error("[!] 钩子递归熔断: " + tag + " trips=" + g.trips + " depth=" + g.last_depth);
}

// 微信退出时精确卸钩：逐个 detach 已登记的 listener 再 flush。
// 不用 Interceptor.detachAll()：微信有 160+ 线程正跑在 trampoline 里，
// 全局清盘会让其它线程跳进正在被复用的指令页，是独立于本次栈溢出的第二个崩溃源。
function releaseRegisteredHooks() {
    var listeners = globalThis.__zmybotHookListeners;
    var tags = Object.keys(listeners);
    var released = 0;
    for (var i = 0; i < tags.length; i++) {
        var listener = listeners[tags[i]];
        if (!listener) continue;
        try {
            listener.detach();
            released++;
        } catch (e) {}
        listeners[tags[i]] = null;
    }
    globalThis.__zmybotHookGuard = {};

    // 还原 ObjC IMP —— 必须排在 Interceptor.flush() 之前。
    // 顺序理由：IMP 指向的正是 Frida 的 NativeCallback 代码页，
    // flush 只是让指令页可回收，真正让微信跳飞的是 method 表里的悬空指针。
    // 这 9 个方法里包含 XAppUpdateManager 的激活热路径，
    // 只要有一个没还原，脚本 unload 后第一次激活就是一次 EXC_BAD_ACCESS。
    //
    // 2026-09-30（P0-4）：这里原本是 restored++ / catch(e3){} / impls.length=0，
    // 三个动作叠在一起的效果是「还原失败 = 没发生过」——脚本照样返回成功，
    // 宿主照样往下走 unload，微信 method 表里留着指向已 munmap 代码页的悬空 IMP，
    // 直接进入 R1 的 697% CPU 坏态，而日志里一行异常都没有。
    // 现在改成逐条计数并把 failures 回传给宿主，让「卸载失败」变成可上报的事实。
    var restored = 0;
    var failures = [];
    var impls = globalThis.__zmybotObjcImpls;
    var api = globalThis.__zmybotObjcApi;
    if (!api) {
        // objc api 没初始化就等于一个都还原不了。这不是「跳过」，是「全丢」。
        for (var k = 0; k < impls.length; k++) {
            failures.push(impls[k].tag + ": objc api unavailable");
        }
        console.error("[!] 退出卸钩: objc api 未初始化, " + impls.length
            + " 个 IMP 全部无法还原");
    } else {
        for (var j = impls.length - 1; j >= 0; j--) {
            var rec = impls[j];
            try {
                if (rec.method.isNull() || rec.oldImpl.isNull()) {
                    failures.push(rec.tag + ": method/oldImpl is null");
                    continue;
                }
                api.methodSetImplementation(rec.method, rec.oldImpl);
                restored++;
            } catch (e3) {
                failures.push(rec.tag + ": " + e3);
            }
            rec.method = ptr(0);
            rec.oldImpl = ptr(0);
        }
    }
    var impTotal = impls.length;
    impls.length = 0;

    try {
        Interceptor.flush();
    } catch (e2) {}
    // imp_failed > 0 意味着微信 method 表里还有指向即将被 munmap 的代码页的指针。
    // 这条日志是上层决定「是否提示用户手动重启微信」的唯一依据，必须打出来。
    if (failures.length > 0) {
        console.error("[!] 退出卸钩: IMP 还原失败 " + failures.length + "/" + impTotal
            + " -> " + failures.join(" | "));
    }
    console.log("[+] 退出卸钩完成, released=" + released + "/" + tags.length
        + ", imp_restored=" + restored + "/" + impTotal);
    return {
        released: released,
        hooks_total: tags.length,
        imp_restored: restored,
        imp_total: impTotal,
        imp_failed: failures.length,
        imp_failures: failures.slice(0, 20)
    };
}

if (globalThis.__WECHAT_AGENT_HOOK_LOADED) {
    console.log("[+] WeChatAgent hook already loaded, skip duplicate setup.");
} else {
    globalThis.__WECHAT_AGENT_HOOK_LOADED = true;
    initAddresses();
}


function initAddresses() {
    var resolved = resolveHookOffsets();
    var unresolved = reportUnresolvedHookOffsets(resolved);
    // fail-closed 门（docs/22 §4）：核心偏移没过指纹校验就整体拒绝注入。
    //
    // 半装状态比不装更糟：一部分 hook 挂着、一部分没挂，行为不可预期；而且
    // 已经挂上的那些在 unload 时还得走一遍完整卸钩（还原 IMP + 排空在飞），
    // 风险面反而比干净地不装更大。
    var mandatoryMissing = reportHookVerify(resolved, unresolved);
    if (mandatoryMissing.length > 0) {
        console.error("[!] 核心偏移指纹校验失败，拒绝注入: " + mandatoryMissing.join(", "));
        globalThis.__zmybotHookVerifyFailed = true;
        return;
    }
    // 文本消息全局变量 (new_text.js approach)
    blrX8Addr = resolved.blrX8Addr;
    autoBufferWriteFunc = resolved.autoBufferWriteFunc;

    // 双方公共使用的地址
    req2bufEnterAddr = resolved.req2bufEnterAddr;
    req2bufExitAddr = resolved.req2bufExitAddr;
    sendFuncAddr = resolved.sendFuncAddr;
    buf2RespAddr = resolved.buf2RespAddr;

    uploadImageAddr = resolved.uploadImageAddr;
    cndOnCompleteAddr = resolved.cndOnCompleteAddr;

    uploadGetCallbackWrapperAddr = resolved.uploadGetCallbackWrapperAddr;
    uploadGetCallbackWrapperFuncAddr = resolved.uploadGetCallbackWrapperFuncAddr;
    uploadOnCompleteAddr = resolved.uploadOnCompleteAddr;
    uploadOnCompleteFuncAddr = resolved.uploadOnCompleteFuncAddr;
    profileReaderAddr = resolved.profileReaderAddr;

	sendMessageCallbackFunc = baseAddr.add(0x0);
	imgMessageCallbackFunc = baseAddr.add(0x0);
	// [已删除] videoMessageCallbackFunc / replyMessageCallbackFunc / voiceMessageCallbackFunc：
	// 只在 initAddresses 里被赋值，从未被任何代码读取，属于纯死变量。

    // 生产 Hook 统一入口：新增 hook 只能在这里通过 scheduleHook 注册。
    // 全部无条件注册。原先这里按档位分成四组 if，现在是平铺的清单 ——
    // 下面每组前面的注释只保留「这一组是干什么的」，不再代表可以被关掉的能力。
    setupRetOneStub();

    // 文本发送
    scheduleHook("setupSendTextMessageDynamic", setupSendTextMessageDynamic);
    scheduleHook("attachBlrX8Hook", attachBlrX8Hook);
    scheduleHook("AttachSendFunc", AttachSendFunc);
    scheduleHook("attachReq2buf", attachReq2buf);

    // 媒体上传
    scheduleHook("setupSendFileMessageDynamic", setupSendFileMessageDynamic);
    scheduleHook("setupSendImgMessageDynamic", setupSendImgMessageDynamic);
    scheduleHook("attachUploadMedia", attachUploadMedia);
    scheduleHook("patchCdnOnComplete", patchCdnOnComplete);
    scheduleHook("attachGetCallbackFromWrapper", attachGetCallbackFromWrapper);

    // 接收
    scheduleHook("setReceiver", setReceiver);

    // 更新守卫（唯一还受开关控制的一组：--block-wechat-update）
    if (ENABLE_UPDATE_GUARD) {
        scheduleHook("installWeChatUpdateGuard", installWeChatUpdateGuard);
    }

    // 常驻
    scheduleHook("installQuitRelease", installQuitRelease);
    scheduleHook("installDbKeyCapture", installDbKeyCapture);
    scheduleHook("attachProfileReader", attachProfileReader);
    scheduleHook("probeAccountInfoAfterLogin", probeAccountInfoAfterLogin);

    // 收图落盘路径捕获（2026-10-06：桌面端「消息与日志」要显示原图路径）
    scheduleHook("installImgFileHook", installImgFileHook);

    // 调度完成哨兵。收包健康状态由真实事件和 hook_verify 上报，不再靠周期心跳
    // 刷运行日志。
    globalThis.__zmybotSchedTotal = Math.round(
        (typeof globalThis.__zmybotSchedCursor === "number" ? globalThis.__zmybotSchedCursor : 0) / 25);
    console.log("[+] 全部钩子已调度, 共 " + globalThis.__zmybotSchedTotal + " 项, 错开间隔 25ms");
}

// -------------------------收图落盘路径捕获分区-------------------------
// 微信 4.x 把收到的图落盘到：
//   …/xwechat_files/<账号>/msg/attach/<md5(会话)>/<yyyy-MM>/Img/<哈希>.dat
// 缩略图 <哈希>_t.dat 收图即写，原图 <哈希>.dat 点开看才下载 —— 两者同基名只差 _t。
// 这里 hook 文件打开 API，凡是 Img 目录里的 .dat 都上报给 daemon（emit_state
// "img_file"）→ 桌面端收进图片路径缓存，「消息与日志」的图片行直接显示本地路径。
// 只观察不拦截，不改微信行为；openat 的路径在第二个参数。
var reportedImgFilePaths = {};
var reportedImgFilePathCount = 0;

function maybeReportImgFilePath(path) {
    try {
        if (!path || path.length < 12) return;
        if (path.indexOf("/Img/") < 0) return;
        if (path.slice(-4) !== ".dat") return;
        if (reportedImgFilePaths[path]) return;
        // 去重表容量兜底：正常一张图只有原始/缩略两三条，永远到不了这
        if (reportedImgFilePathCount > 800) {
            reportedImgFilePaths = {};
            reportedImgFilePathCount = 0;
        }
        reportedImgFilePaths[path] = 1;
        reportedImgFilePathCount += 1;
        send({
            type: "img_file",
            path: path,
            is_thumb: path.slice(-6) === "_t.dat",
            pid: Process.id
        });
    } catch (e) {
        console.error("[img-file] report failed: " + e);
    }
}

function installImgFileHook() {
    // libc 三件套：微信的媒体落盘最终都走它们。读/写都报（路径本身就是结论）。
    var targets = [
        { name: "open", pathArg: 0 },
        { name: "open64", pathArg: 0 },
        { name: "fopen", pathArg: 0 },
        { name: "openat", pathArg: 1 }
    ];
    var installed = 0;
    targets.forEach(function (item) {
        var addr = null;
        try { addr = Module.getExportByName(null, item.name); } catch (e) { addr = null; }
        if (!addr) return;
        try {
            Interceptor.attach(addr, {
                onEnter: function (args) {
                    try {
                        var pathPtr = args[item.pathArg];
                        if (!pathPtr || pathPtr.isNull()) return;
                        var path = pathPtr.readUtf8String();
                        if (path) maybeReportImgFilePath(path);
                    } catch (e) { /* 读串失败不影响微信 */ }
                }
            });
            installed += 1;
        } catch (e) {
            console.error("[img-file] hook " + item.name + " failed: " + e);
        }
    });
    console.log("[+] img-file 路径捕获已挂载, 共 " + installed + " 个文件 API");
}

function installDbKeyCapture() {
    if (globalThis.__zmybotDbKeyHook) return;
    globalThis.__zmybotDbKeyHook = true;
    var seen = {};
    var dbKeyListeners = [];
    var dbKeySettleTimer = 0;
    // 密钥不是注入时就有的：微信只在开库/派生账号密钥时才会调
    // CCKeyDerivationPBKDF。注入完全可能发生在微信已经把库打开之后——
    // 那一刻起算的倒计时窗口会必然到期，然后登录时的那次调用无人接。
    // 所以监听器**常驻不自摘**，由用户回到微信点「登录」来触发第一次命中；
    // 命中后才开收集期，吸收「先派生候选值、再开库派生真 key」的多次调用，
    // 收集期结束才摘。这样代价只是常驻一个不热的系统导出拦截。
    var DB_KEY_SETTLE_MS = 60000;
    function hexBytes(p, n) {
        try {
            var b = new Uint8Array(p.readByteArray(n));
            var s = "";
            for (var i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
            return s;
        } catch (e) { return ""; }
    }
    function emit(keyHex, saltHex, tag) {
        keyHex = String(keyHex || "").trim().replace(/^0x/i, "").toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(keyHex) || seen[keyHex]) return;
        if (globalThis.__zmybotQuitting) return;
        seen[keyHex] = 1;
        send({ type: "db_key", key: keyHex, enc_key: keyHex, salt: saltHex || "", tag: tag || "" });
        // 收集期从第一次命中起算，期间后续候选继续上报。
        scheduleDbKeySettle();
    }
    function resolve(name) {
        try { return Module.findGlobalExportByName(name); } catch (e) { return null; }
    }
    function scheduleDbKeySettle() {
        if (dbKeySettleTimer) return;
        dbKeySettleTimer = setTimeout(function () {
            for (var i = 0; i < dbKeyListeners.length; i++) {
                try { dbKeyListeners[i].detach(); } catch (e) {}
            }
            dbKeyListeners = [];
            console.log("[+] DB key capture detached after settle window.");
        }, DB_KEY_SETTLE_MS);
    }
    var pbkdf = resolve("CCKeyDerivationPBKDF");
    if (!pbkdf) {
        // 静默 return 会让 UI 白等 5 分钟才超时；这里把原因冒到宿主日志。
        console.error("[!] 未找到 CCKeyDerivationPBKDF，数据库密钥捕获未安装");
        send({ type: "db_key_status", state: "unavailable", reason: "export_missing", pid: Process.id });
        return;
    }
    console.log("[+] DB key capture armed, waiting for key derivation (login).");
    // 常驻直到第一次命中，之后由 scheduleDbKeySettle 收尾；这个 listener 同时
    // 登记进全局表，微信退出时的 releaseRegisteredHooks 也能把它清掉。
    var pbkdfListener = Interceptor.attach(pbkdf, {
        onEnter: function (args) {
            if (!enterHook("db_key_pbkdf")) return;
            try {
                var passLen = args[2].toInt32();
                var saltLen = args[4].toInt32();
                var rounds = args[6].toInt32();
                if (passLen !== 32 || (rounds !== 256000 && rounds !== 2)) return;
                var salt = saltLen === 16 ? hexBytes(args[3], 16) : "";
                emit(hexBytes(args[1], 32), salt, "pbkdf2-" + rounds);
            } catch (e) {} finally { leaveHook(); }
        }
    });
    dbKeyListeners.push(pbkdfListener);
    registerHookListener("db_key_pbkdf", pbkdfListener);
}

function installQuitRelease() {
    if (globalThis.__zmybotQuitHookInstalled) return;
    globalThis.__zmybotQuitHookInstalled = true;
    globalThis.__zmybotQuitting = false;
    function releaseHooksForQuit() {
        if (globalThis.__zmybotQuitting) return;
        globalThis.__zmybotQuitting = true;
        try { send({ type: "wechat_quit" }); } catch (e) {}
        setTimeout(function () {
            try { releaseRegisteredHooks(); } catch (e2) {}
        }, 0);
    }
    var quitHooks = 0;
    ["exit", "_exit"].forEach(function (name) {
        try {
            var addr = findExportCompat(name);
            registerHookListener("quit_release_" + name, Interceptor.attach(addr, { onEnter: function () {
                if (!enterHook("quit_release_" + name)) return;
                try { releaseHooksForQuit(); } finally { leaveHook(); }
            } }));
            quitHooks++;
        } catch (e) {
            console.error("[-] 退出卸钩未挂上 " + name + ": " + e);
        }
    });
    try {
        var getClassAddr = findExportCompat("objc_getClass");
        var selAddr = findExportCompat("sel_registerName");
        var methodAddr = findExportCompat("class_getInstanceMethod");
        var impAddr = findExportCompat("method_getImplementation");
        var getClass = new NativeFunction(getClassAddr, "pointer", ["pointer"]);
        var regSel = new NativeFunction(selAddr, "pointer", ["pointer"]);
        var getMethod = new NativeFunction(methodAddr, "pointer", ["pointer", "pointer"]);
        var getImp = new NativeFunction(impAddr, "pointer", ["pointer"]);
        var cls = getClass(Memory.allocUtf8String("NSApplication"));
        var sel = regSel(Memory.allocUtf8String("terminate:"));
        if (cls.isNull() || sel.isNull()) return;
        var method = getMethod(cls, sel);
        if (method.isNull()) return;
        var imp = getImp(method);
        if (imp.isNull()) return;
        registerHookListener("quit_release_terminate", Interceptor.attach(imp, { onEnter: function () {
            if (!enterHook("quit_release_terminate")) return;
            try { releaseHooksForQuit(); } finally { leaveHook(); }
        } }));
        quitHooks++;
        // 文案别写成「微信退出时先卸钩」——这行是**注册完成**的确认，
        // 此刻微信并没有退出。旧文案会让看日志的人以为钩子被误卸了。
        console.log("[+] 已注册微信退出卸钩钩子, 退出钩子数=" + quitHooks);
    } catch (e) {
        console.log("[-] 退出卸钩未挂上: " + e);
    }
}

// 偏移解析：**fail-closed**，任何必需偏移都必须通过强校验才允许使用。
//
// 强校验只有两种来源：
//   1. 入口字节指纹（HOOK_ENTRY_BYTES，16 字节逐字节相等）
//   2. 特征扫描（HOOK_SCAN_PATTERNS，16+ 字节带通配签名）
// 两者都是「地址处确实是预期的机器码」，不是猜。
//
// 2026-10-01 改掉的旧行为：解析不出来时**仍然沿用配置里的地址**。
// 那就是拿一个没验证过的地址去下 Interceptor —— 挂对了是运气，挂错了
// 是在往未知指令上打补丁，最坏把微信打成脏态（悬空 IMP / 高 CPU）。
// 现在没通过校验就一律剔除，让对应 hook 走「地址为空 -> 跳过」这条既有路径。
function resolveHookOffsets() {
    var out = {};
    var verified = {};
    var required = requiredHookOffsets();

    // 1) 配置偏移 + 入口字节校验
    Object.keys(required).forEach(function(name) {
        if (!HOOK_ENTRY_BYTES[name]) return;
        var addr = configuredHookAddress(name);
        if (!addr) return;
        if (configuredAddressHasExpectedBytes(name, addr)) {
            out[name] = addr;
            verified[name] = true;
            console.log("[+] 配置偏移通过入口字节校验 " + name + " => " + relOff(addr));
        } else {
            console.log("[!] 配置偏移入口字节不匹配，已剔除 " + name + " => " + relOff(addr));
        }
    });

    // 2) 特征扫描（同样是强校验：命中即证明该地址是预期函数）
    Object.keys(HOOK_SCAN_PATTERNS).forEach(function(name) {
        if (!required[name] || verified[name]) return;
        var scanned = scanHookAddress(name, HOOK_SCAN_PATTERNS[name]);
        if (!scanned) {
            console.log("[!] 特征扫描未命中 " + name);
            return;
        }
        out[name] = scanned;
        verified[name] = true;
        console.log("[+] Frida 扫描解析 " + name + " => " + relOff(scanned));
    });

    // 3) 派生量：基址已校验，推导出的地址继承其可信度
    if (verified.req2bufEnterAddr) {
        if (!verified.blrX8Addr) {
            out.blrX8Addr = out.req2bufEnterAddr.add(0x80);
            verified.blrX8Addr = true;
        }
        if (!verified.req2bufExitAddr) {
            out.req2bufExitAddr = out.req2bufEnterAddr.add(0x1114);
            verified.req2bufExitAddr = true;
        }
    }
    if (verified.buf2RespAddr && !verified.autoBufferWriteFunc) {
        out.autoBufferWriteFunc = out.buf2RespAddr.add(0x1668);
        verified.autoBufferWriteFunc = true;
    }

    // 4) fail-closed：没被上面任何一步验证过的必需偏移，剔除。
    Object.keys(required).forEach(function(name) {
        if (!verified[name]) {
            delete out[name];
        }
    });
    return out;
}

// 版本包必须提供的偏移全集。档位删除后这里是固定清单：
// 少任何一个偏移，对应 hook 在 install 时会自己 skip（不是崩，是静默不挂），
// 所以新增 hook 偏移时记得同步加进来，否则会变成「版本包缺了但不报错」的哑失败。
function requiredHookOffsets() {
    return {
        // 常驻
        profileReaderAddr: true,
        // 接收
        buf2RespAddr: true,
        // 文本发送
        blrX8Addr: true,
        autoBufferWriteFunc: true,
        req2bufEnterAddr: true,
        req2bufExitAddr: true,
        sendFuncAddr: true,
        // 媒体上传
        uploadImageAddr: true,
        cndOnCompleteAddr: true,
        uploadGetCallbackWrapperAddr: true,
        uploadGetCallbackWrapperFuncAddr: true,
        uploadOnCompleteAddr: true,
        uploadOnCompleteFuncAddr: true
    };
}

/**
 * 集中报告「required 但没解析出来」的偏移。
 *
 * 为什么需要：resolveHookOffsets() 对解析失败的键是「不设」而不是「设成 null」，
 * 于是 resolved.xxx 变成 undefined，最终 Interceptor.attach(undefined) 抛
 * `TypeError: Cannot read property 'target' of null`。
 * 那条错在 scheduleHook 的 catch 里被打包成一行，**看不出是哪个偏移没解析出来**，
 * 于是每次注入都刷一条噪声，反而掩盖真正的稳定性告警。
 *
 * 这里在装钩之前先把清单打出来：缺哪个、来自配置还是扫描，一目了然。
 */
// 上报未能通过强校验的必需偏移。
//
// 返回结构化条目（而不是拼好的字符串），是为了让 initAddresses 能判断
// 「缺的是不是核心偏移」——核心缺失要整体拒绝注入，非核心缺失只降级。
function reportUnresolvedHookOffsets(resolved) {
    var required = requiredHookOffsets();
    var missing = [];
    Object.keys(required).forEach(function (name) {
        if (resolved[name]) {
            return;
        }
        var configured = configuredHookAddress(name);
        missing.push({
            name: name,
            // 「配置有值但校验没通过」比「配置缺失」更值得警惕：说明版本包
            // 里的偏移对不上当前微信二进制，是必须暴露给用户的信号。
            reason: configured ? "配置有值但指纹校验未通过" : "配置缺失且扫描未命中",
            configured_offset: configured ? relOff(configured) : null
        });
    });
    if (missing.length > 0) {
        console.warn("[-] 以下必需偏移未通过强校验，相关 hook 会被跳过（不猜偏移）: "
            + missing.map(function (item) { return item.name + "(" + item.reason + ")"; }).join(", "));
    }
    return missing;
}

// 把校验结果上报给宿主。
//
// 为什么必须 send 而不是只 console.warn：桥的 stdout 不会进 zmybot 的日志
// （只在报错时才带出 stderr），所以「某个 hook 被静默剔除」对上层是彻底
// 不可见的 —— 表现就是「接入成功、状态全绿，但发图发不出去」。
// 上层拿这个才能把降级如实显示出来，而不是拿 `*_hook_ready`（那只是
// `attached` 的镜像）冒充「hook 都挂上了」。
function reportHookVerify(resolved, unresolved) {
    var mandatoryMissing = unresolved.filter(function (item) {
        return MANDATORY_HOOK_OFFSETS.indexOf(item.name) >= 0;
    }).map(function (item) { return item.name; });
    send({
        type: "hook_verify",
        verified: Object.keys(resolved).sort(),
        unresolved: unresolved,
        mandatory_missing: mandatoryMissing
    });
    return mandatoryMissing;
}

// 非入口偏移的诊断记录。收集起来随 hook_verify 一起上报，
// 让「偏移可能记错」变成可观测数据，而不是只能靠读日志猜。
function noteNonEntryOffset(name, addr, reason) {
    if (!globalThis.__zmybotNonEntryOffsets) {
        globalThis.__zmybotNonEntryOffsets = [];
    }
    globalThis.__zmybotNonEntryOffsets.push({ name: name, off: relOff(addr), reason: reason });
    console.log("[!] 偏移不在函数入口 " + name + " => " + relOff(addr) + " : " + reason +
                "（字节指纹一致。仅作诊断：若为故意的中间点 hook 则正常，" +
                "若该钩子始终零命中则说明版本包偏移记错）");
}

function configuredHookAddress(name) {
    var value = CONFIGURED_HOOK_OFFSETS[name];
    if (!value || value.indexOf("<no value>") >= 0) {
        return null;
    }
    var n = parseInt(value, 16);
    if (!isFinite(n) || n <= 0) {
        return null;
    }
    return baseAddr.add(n);
}

function configuredAddressHasExpectedBytes(name, addr) {
    var expected = HOOK_ENTRY_BYTES[name];
    if (!expected || expected.indexOf("<no value>") >= 0) {
        return false;
    }
    var expectedBytes = parseExactHexBytes(expected);
    if (expectedBytes.length === 0) {
        return false;
    }
    try {
        var actual = new Uint8Array(addr.readByteArray(expectedBytes.length));
        for (var i = 0; i < expectedBytes.length; i++) {
            if (actual[i] !== expectedBytes[i]) {
                console.log("[!] Configured offset byte mismatch " + name + " => " + relOff(addr));
                return false;
            }
        }
        // 字节一致还不够 —— 但这里**只诊断不拒绝**。
        //
        // 字节指纹是循环验证（版本包记什么就拿什么去比），抓不住「偏移指向
        // 函数中部」。序言检查是独立判据，能暴露这类问题，但不能用来拒绝：
        // 本项目里 blrX8Addr（hook 的是 blr x8 指令本身）、req2bufExitAddr
        // （ldp 是函数尾声）都是**故意的中间点**，静态上看就是「没有序言」。
        // 静态特征无法区分「故意的中间点」与「记错的偏移」，只有动态命中率能。
        // 所以这里记进诊断，由命中统计去裁决，硬拒绝会误杀正常 hook。
        var entry = looksLikeFunctionEntry(addr);
        if (!entry.ok) {
            noteNonEntryOffset(name, addr, entry.reason);
        }
        return true;
    } catch (e) {
        console.log("[!] Configured offset byte check failed " + name + ": " + e);
        return false;
    }
}

// AArch64 函数入口判定。
//
// 为什么必须有它：入口字节指纹是**循环验证** —— 它只证明「该地址处的机器码
// 与版本包记录的字节一致」。2026-10-01 在 4.1.12.53 上实测到反例：
//   buf2RespAddr = 0x4163f4c，入口字节 `3c 00 80 52 ...` 与版本包完全一致，
//   指纹校验通过、状态接口全绿、15/15 钩子安装成功 —— 但该地址处是
//   `mov w28, #1`，一条位于函数**中部**、只在特定分支执行的赋值指令，
//   最近的标准序言远在 +0x15a4 之外。收消息因此永远命中数为 0。
//
// 指纹无法抓住这类错误，因为版本包和校验用的是同一份字节。序言是独立判据：
// 它不看版本包说了什么，只看该地址在指令层面是否像函数起点。
//
// 判定范围刻意保守：只认「减栈 / 存 x29,x30 / pacibsp / bti」这几类
// 编译器必现的序言指令。宁可漏判（回落到原有字节校验）也不误杀，
// 因为误杀会让原本正常的 hook 被剔除。
function looksLikeFunctionEntry(addr) {
    // 需要读到序言可能出现的范围：序言最晚出现在第 5 条指令内。
    var SPAN = 5 * 4;
    var raw = null;
    try {
        raw = new Uint8Array(addr.readByteArray(SPAN));
    } catch (e) {
        return { ok: false, reason: "读取指令失败: " + e };
    }
    if (raw.length < SPAN) {
        return { ok: false, reason: "指令区不可读" };
    }
    var prologueInsns = [];
    for (var i = 0; i < SPAN / 4; i++) {
        var w = (raw[i * 4] | (raw[i * 4 + 1] << 8) | (raw[i * 4 + 2] << 16) | (raw[i * 4 + 3] << 24)) >>> 0;
        // pacibsp / bti：函数/分支目标的入口标记
        if (w === 0xd503233f) { prologueInsns.push(i, "pacibsp"); }
        if ((w & 0xffffffe0) === 0xd50320e0) { prologueInsns.push(i, "bti"); }
        // sub sp, sp, #imm12  (add/sub immediate, Rd=x31, Rn=x31, sub, keep 64bit)
        //   sf=1 op=1 S=0 10001 sh=0 imm12 Rn=31 Rd=31
        if ((w & 0xffc003ff) === 0xd10003ff) { prologueInsns.push(i, "sub sp,sp"); }
        // stp <Xt1>,<Xt2>,[sp,#-imm]!  (pre-index) —— 存 x29,x30 在其中
        //   STP 64-bit pre-index: 10 101 01 10 imm7 011 10 imm9 Rt2 Rn Rt
        if ((w & 0xffc003e0) === 0xa98003e0) { prologueInsns.push(i, "stp [sp,#-]!"); }
        // stp <Xt1>,<Xt2>,[sp,#imm]（非 pre-index，紧跟 sub sp 之后出现的变体）
        if ((w & 0xffc003e0) === 0xa90003e0) { prologueInsns.push(i, "stp [sp,#]"); }
    }
    if (prologueInsns.length === 0) {
        return { ok: false, reason: "无 AArch64 序言特征" };
    }
    var detail = [];
    for (var k = 0; k < prologueInsns.length; k += 2) {
        detail.push("+" + prologueInsns[k] * 4 + " " + prologueInsns[k + 1]);
    }
    return { ok: true, reason: detail.join(", ") };
}

function parseExactHexBytes(value) {
    var bytes = [];
    String(value).trim().split(/\s+/).forEach(function(part) {
        if (!part || part === "??") {
            return;
        }
        var n = parseInt(part, 16);
        if (isFinite(n)) {
            bytes.push(n & 0xff);
        }
    });
    return bytes;
}

function scanHookAddress(name, spec) {
    try {
        var hits = Memory.scanSync(baseAddr, module.size, spec.pattern);
        if (hits.length !== 1) {
            if (hits.length > 1) {
                console.log("[!] Frida scan " + name + " got multiple hits: " + hits.length + ", keep configured.");
            }
            return null;
        }
        return hits[0].address.sub(spec.adjust || 0);
    } catch (e) {
        console.error("[-] Frida scan failed: " + name + ": " + e);
        return null;
    }
}

function relOff(addr) {
    return "0x" + addr.sub(baseAddr).toString(16);
}

// 调度游标。必须用 globalThis 而不是模块级 var：脚本主体（initAddresses 的调用点
// 在文件靠前位置）先于本行的赋值执行，模块级 var 在那一刻是 undefined，
// setTimeout(fn, NaN) 会被当成 0ms，15 个 hook 同时注入。
// 放在 globalThis 上由 scheduleHook 自身惰性初始化，与声明位置彻底解耦。
function scheduleHook(name, setupFn) {
    if (typeof globalThis.__zmybotSchedCursor !== "number") {
        globalThis.__zmybotSchedCursor = 0;
    }
    if (typeof globalThis.__zmybotSchedResults !== "object" || globalThis.__zmybotSchedResults === null) {
        globalThis.__zmybotSchedResults = [];
    }
    var delay = globalThis.__zmybotSchedCursor;
    globalThis.__zmybotSchedCursor += 25;
    var results = globalThis.__zmybotSchedResults;
    setTimeout(function() {
        // 结果记进 results，最后一个跑完的负责汇总上报。
        // 不逐条 console.log：15 条 setTimeout 回调挤在 350ms 内，
        // 逐条上报会在日志里挤掉真正重要的那条（现场：回调内的
        // 「Hook setup complete」一条都没打出来，而心跳照常）。
        try {
            setupFn();
            results.push({ name: name, ok: true });
        } catch (e) {
            results.push({ name: name, ok: false, err: excTextOf(e) });
        }
        if (results.length === globalThis.__zmybotSchedTotal) {
            var failed = results.filter(function (r) { return !r.ok; });
            console.log("[+] 钩子调度汇总: 共 " + results.length + " 项, 失败 " + failed.length +
                        (failed.length ? " -> " + failed.map(function (r) {
                            return r.name + ": " + r.err;
                        }).join(" | ") : ""));
        }
    }, delay);
}

// 供 scheduleHook 汇报异常用；Frida 的 e 有时不是 Error，String() 更安全。
function excTextOf(e) {
    try {
        if (e && e.stack) return String(e.stack).split("\n")[0];
        return String(e);
    } catch (_) {
        return "unknown";
    }
}

function installWeChatUpdateGuard() {
    if (globalThis.__ZMYBOT_WECHAT_UPDATE_GUARD_LOADED) {
        return;
    }
    globalThis.__ZMYBOT_WECHAT_UPDATE_GUARD_LOADED = true;
    globalThis.__ZMYBOT_UPDATE_GUARD_CBS = globalThis.__ZMYBOT_UPDATE_GUARD_CBS || [];
    function keepCb(cb) { globalThis.__ZMYBOT_UPDATE_GUARD_CBS.push(cb); return cb; }

    var installed = 0;
    var spoofed = 0;
    var blockedHits = 0;
    var notes = [];
    var localFull = "";
    function report(event, extra) {
        var payload = {
            type: "wechat_update_guard",
            event: event,
            hooks: installed,
            spoofed: spoofed,
            blocked_hits: blockedHits,
            enable_update_guard: !!ENABLE_UPDATE_GUARD,
            spoof_wechat_version: !!SPOOF_WECHAT_VERSION,
            reported_full_version: REPORTED_FULL_VERSION || "",
            reported_short_version: REPORTED_SHORT_VERSION || "",
            reported_patch_version: REPORTED_PATCH_VERSION || "",
            reported_bundle_version: REPORTED_BUNDLE_VERSION || "",
            local_full_version: localFull || "",
            notes: notes.slice(0, 40)
        };
        if (extra) {
            Object.keys(extra).forEach(function(k) { payload[k] = extra[k]; });
        }
        try { send(payload); } catch (e) {}
        console.log("[+] WeChat update guard " + event + " hooks=" + installed + " spoofed=" + spoofed +
            " blocked_hits=" + blockedHits + " reported=" + (REPORTED_FULL_VERSION || "") + " local=" + (localFull || ""));
    }

    // Frida 17.x 本环境可能没有 ObjC bridge，统一走原生 runtime API。
    var objc = null;
    // 挂到 globalThis：releaseRegisteredHooks 要用 objc.methodSetImplementation 还原 IMP，
    // 而那个函数在 installWeChatUpdateGuard 的作用域之外，拿不到这里的局部变量。
    globalThis.__zmybotObjcApi = null;
    try {
        objc = {
            getClass: new NativeFunction(findExportCompat("objc_getClass"), "pointer", ["pointer"]),
            selRegisterName: new NativeFunction(findExportCompat("sel_registerName"), "pointer", ["pointer"]),
            classGetInstanceMethod: new NativeFunction(findExportCompat("class_getInstanceMethod"), "pointer", ["pointer", "pointer"]),
            classGetClassMethod: new NativeFunction(findExportCompat("class_getClassMethod"), "pointer", ["pointer", "pointer"]),
            methodSetImplementation: new NativeFunction(findExportCompat("method_setImplementation"), "pointer", ["pointer", "pointer"]),
            methodGetImplementation: new NativeFunction(findExportCompat("method_getImplementation"), "pointer", ["pointer"]),
            msgSend: new NativeFunction(findExportCompat("objc_msgSend"), "pointer", ["pointer", "pointer"]),
            msgSendPtr1: new NativeFunction(findExportCompat("objc_msgSend"), "pointer", ["pointer", "pointer", "pointer"])
        };
        globalThis.__zmybotObjcApi = objc;
    } catch (e) {
        notes.push("native objc api init failed: " + e);
        report("failed");
        return;
    }

    function cstr(s) {
        return Memory.allocUtf8String(s);
    }

    function nsString(s) {
        var NSString = objc.getClass(cstr("NSString"));
        if (NSString.isNull()) return ptr(0);
        return objc.msgSendPtr1(NSString, objc.selRegisterName(cstr("stringWithUTF8String:")), cstr(String(s || "")));
    }

    function readCString(p) {
        if (!p || p.isNull()) return "";
        try { return p.readUtf8String(); } catch (e) { return ""; }
    }

    function nsStringToUtf8(ns) {
        if (!ns || ns.isNull()) return "";
        try {
            var c = objc.msgSend(ns, objc.selRegisterName(cstr("UTF8String")));
            return readCString(c);
        } catch (e) {
            return "";
        }
    }

    function markBlocked(tag) {
        blockedHits++;
        if (blockedHits <= 30) {
            console.log("[+] WeChat update guard blocked: " + tag);
        }
        if (blockedHits === 1 || blockedHits === 10 || blockedHits === 30 || (blockedHits % 100) === 0) {
            report("blocked", { last_blocked: tag, blocked_hits: blockedHits });
        }
    }

    // 2026-09-30 裁剪：原实现逐个 noop 掉 164 个方法（XAppUpdateManager 61 个、
    // SPUUpdater 23 个、SUUpdater 16 个、SPUStandardUserDriver 11 个……），
    // 注入面铺到 25 个类上，其中大半是 getter/setter。这有三个硬伤：
    //   1. 返回类型不匹配。makeNoopCb 声明 void，但 `feedURLStringForUpdater:`
    //      `immediateInstallHandler` `canCheckForUpdate` `isUpdateReady` 这些
    //      实际返回对象/BOOL/Bool，调用方按约定读 x0 —— 拿到的是垃圾。
    //      feedURLStringForUpdater: 返回垃圾指针后被当 NSString 解引用，
    //      就是 EXC_BAD_ACCESS 级别的崩法。
    //   2. 封堵逻辑是冗余的。真正落地安装的入口只有少数几个，把 164 个都清空
    //      并不比堵住 8 个更安全，只是把风险面放大。
    //   3. 触碰 Foundation / Sparkle 内部状态机。清掉 SPUUpdater 的 setter 会让
    //      驱动层读到未初始化的状态，属于「为拦一只狗拆整面墙」。
    // 现在改成「入口封堵」：只碰真正执行更新和安装的方法，其余一律不挂。
    function replaceMethod(className, selectorName, implPtr, isClassMethod) {
        try {
            var cls = objc.getClass(cstr(className));
            if (cls.isNull()) {
                notes.push("class missing: " + className);
                return ptr(0);
            }
            var sel = objc.selRegisterName(cstr(selectorName));
            var method = isClassMethod
                ? objc.classGetClassMethod(cls, sel)
                : objc.classGetInstanceMethod(cls, sel);
            if (method.isNull()) {
                notes.push("method missing: " + className + " " + selectorName);
                return ptr(0);
            }
            var oldImpl = objc.methodGetImplementation(method);
            objc.methodSetImplementation(method, implPtr);
            // 登记原 IMP，releaseRegisteredHooks 卸载时逐个还原。
            // 不登记就是 18:10 那次崩溃：脚本一 unload，code page 没了，
            // method 表还指着它，微信下次调这个方法直接跳进未映射内存。
            globalThis.__zmybotObjcImpls.push({
                method: method,
                oldImpl: oldImpl,
                tag: className + " " + (isClassMethod ? "+" : "-") + selectorName
            });
            installed++;
            console.log("[+] WeChat update guard hooked " + className + " " + (isClassMethod ? "+" : "-") + selectorName);
            return oldImpl;
        } catch (e) {
            notes.push("hook failed: " + className + " " + selectorName + ": " + e);
            console.error("[-] WeChat update guard failed " + className + " " + selectorName + ": " + e);
            return ptr(0);
        }
    }

    // 终端型回调：重入时直接返回中性值，不做任何 JS 记账。
    // arity = number of ObjC args after self/_cmd
    function makeVoidCb(arity, tag) {
        var types = ["pointer", "pointer"];
        for (var i = 0; i < arity; i++) types.push("pointer");
        return keepCb(new NativeCallback(function() {
            if (globalThis.__zmybotHookDepth >= HOOK_MAX_DEPTH) {
                tripHookGuard("objc:void:" + (tag || "?"), globalThis.__zmybotHookDepth);
                return;
            }
            globalThis.__zmybotHookDepth++;
            try {
                if (tag) markBlocked(tag);
            } finally { leaveHook(); }
        }, "void", types));
    }

    // [已删除] makeBoolCb —— 随 canCheckForUpdate 一起移除（2026-09-30）。
    // 它是唯一返回 BOOL 的 ObjC 回调工厂，唯一的调用方就是 canCheckForUpdate。
    // 留着它等于留着一条「随时可以再造一个 KVC 可达 BOOL getter」的旁路，
    // 而这正是本次崩溃的成因。这里显式留空，防止后续不小心再引入。

    // 读取本地版本：优先由 Rust runtime 注入，避免进程内 objectForInfoDictionaryKey 读到坏指针。
    localFull = String(LOCAL_FULL_VERSION || "").trim();
    if (!localFull) {
        try {
            var NSBundle = objc.getClass(cstr("NSBundle"));
            if (!NSBundle.isNull()) {
                var mainBundle = objc.msgSend(NSBundle, objc.selRegisterName(cstr("mainBundle")));
                if (mainBundle && !mainBundle.isNull()) {
                    var key = nsString("WeChatBundleVersion");
                    var val = objc.msgSendPtr1(mainBundle, objc.selRegisterName(cstr("objectForInfoDictionaryKey:")), key);
                    localFull = nsStringToUtf8(val);
                    if (!localFull) {
                        key = nsString("CFBundleShortVersionString");
                        val = objc.msgSendPtr1(mainBundle, objc.selRegisterName(cstr("objectForInfoDictionaryKey:")), key);
                        localFull = nsStringToUtf8(val);
                    }
                }
            }
        } catch (e) {
            notes.push("read local version failed: " + e);
        }
    } else {
        notes.push("local_version_source=runtime_plist");
    }

    // ========== 封堵集：7 个方法，全部是「执行更新」或「执行安装」的入口 ==========
    // 1) startUpdater —— Sparkle 的总启动入口，堵住它整个更新框架就不会初始化，
    //    后面 2)~5) 是「万一它还是起来了」的兜底。
    replaceMethod("XAppUpdateManager", "startUpdater", makeVoidCb(0, "XAppUpdateManager.startUpdater"), false);
    replaceMethod("XAppUpdateManager", "initSparkleConfigIfNeeded", makeVoidCb(0, "XAppUpdateManager.initSparkleConfigIfNeeded"), false);
    // 2) 检查类入口：堵掉就不再有 appcast 拉取、不会发现新版本、不会弹窗。
    replaceMethod("XAppUpdateManager", "checkForUpdates:", makeVoidCb(1, "XAppUpdateManager.checkForUpdates:"), false);
    replaceMethod("XAppUpdateManager", "startBackgroundUpdatesCheck", makeVoidCb(0, "XAppUpdateManager.startBackgroundUpdatesCheck"), false);
    // [已删除] canCheckForUpdate —— 2026-09-30 18:10 崩溃的直接目标。
    // 它是本脚本唯一替换成 BOOL 返回的 getter，而 BOOL getter 是唯一能被
    // valueForKey: / KVO 通知链「不按函数签名、只按 method 表」取到并调用到的
    // 形态。实测崩溃链就是 Sparkle 的 KVO 观察者 -> NSKeyValueNotifyObserver
    // -> wechat.dylib 观察者回调 -> valueForKey: -> _NSGetBoolValueWithMethod
    // -> 跳进已 munmap 的 NativeCallback 页。
    // 封堵收益也确实是零：Sparkle 的启动/检查/安装入口（上面 4 个 +
    // 下面 quitAndInstall + SUInstallerLauncher）已经全被堵死，
    // 「能不能检查」这个 getter 根本不会被有意义地读到。
    // 少一个 KVC 热路径上的悬空指针，比多堵一个空 getter 值得多。
    // 3) 退出并安装：静默更新的落地点，堵掉它已下载的包也不会被应用。
    replaceMethod("XAppUpdateManager", "quitAndInstallIfNeeded:", makeVoidCb(1, "XAppUpdateManager.quitAndInstallIfNeeded:"), false);
    replaceMethod("XAppUpdateManager", "quitAndInstallIfNeeded:extraInfo:", makeVoidCb(2, "XAppUpdateManager.quitAndInstallIfNeeded:extraInfo:"), false);
    // 4) 安装器落地：Sparkle 侧真正的 launch，绕过 XApp 直接走这条路也要堵。
    replaceMethod("SUInstallerLauncher", "launchInstallerWithHostBundlePath:updaterIdentifier:authorizationPrompt:installationType:allowingDriverInteraction:completion:", makeVoidCb(6, "SUInstallerLauncher.launchInstaller"), false);

    // [已删除] appDidBecomeActive: 的透传 hook（2026-09-30）
    // 删它的理由很直接：这个 hook 的净效果只有「什么都不做」。
    // 它不改返回值、不拦截副作用，只调了两次 markBlocked 记一下账
    // （而且只记前 5 次），随后原样调用原实现 —— 和不挂这个 hook
    // 在微信侧完全等价。封堵职责早已由上面 7 个入口承担。
    // 代价却是实打实的：
    //   1. 它挂在主线程激活热路径上，每次 app 激活都要过 trampoline + 抢 JS 锁；
    //   2. 回调内部每次都 new NativeFunction(original, ...) —— 每次激活新建
    //      一个 NativeFunction 包装对象，纯泄漏，没有任何理由不提到外面复用；
    //   3. 它的 IMP 同样进 method 表，同样是悬空指针的候选（只是它是 void，
    //      不像 canCheckForUpdate 那样被 KVC 直接读到）。
    // 「零收益 + 热路径 + 每次调用泄漏」，三条全中，没有保留理由。

    // ========== 版本伪装：只改「版本号展示」这一层 ==========
    // 2026-09-30 删除：原先还 hook 了 NSBundle 的 objectForInfoDictionaryKey:
    //（全局替换 Foundation 的方法，任何 bundle 任何线程的每次查询都进 JS）和
    // Sparkle 的 SPUAppcastItemStateResolver initWithHostVersion:。
    // 前者是 Foundation 级热路径、后者在 Sparkle 不启动时根本不会被调用，
    // 两者都只有「让更新界面显示旧版本号」这一个作用 —— 而更新界面已经不出现了。
    // 保留展示层替换即可达成同样的用户可见效果。
    if (SPOOF_WECHAT_VERSION && REPORTED_FULL_VERSION) {
        var makeRetainedString = function(text) {
            var ns = nsString(text);
            if (ns.isNull()) return ptr(0);
            return objc.msgSend(ns, objc.selRegisterName(cstr("retain")));
        };
        // 预构造 + 一次性 retain，hook 内零分配。旧实现在热路径返回自动释放对象，
        // 指针过期后被读取就是 access violation，这里彻底规避。
        var spoofFullNS = makeRetainedString(REPORTED_FULL_VERSION);
        var displayCb = keepCb(new NativeCallback(function(self, _cmd, update, bundleDisplay, bundleVersion) {
            if (globalThis.__zmybotHookDepth >= HOOK_MAX_DEPTH) {
                tripHookGuard("objc:formatUpdateDisplayVersion", globalThis.__zmybotHookDepth);
                return spoofFullNS.isNull() ? ptr(0) : spoofFullNS;
            }
            globalThis.__zmybotHookDepth++;
            try {
            spoofed++;
            return spoofFullNS.isNull() ? ptr(0) : spoofFullNS;
            } finally { leaveHook(); }
        }, "pointer", ["pointer", "pointer", "pointer", "pointer", "pointer"]));
        replaceMethod("XStandardVersionDisplay", "formatUpdateDisplayVersionFromUpdate:andBundleDisplayVersion:withBundleVersion:", displayCb, false);
        replaceMethod("SPUStandardVersionDisplay", "formatUpdateDisplayVersionFromUpdate:andBundleDisplayVersion:withBundleVersion:", displayCb, false);
        notes.push("spoof_layer=display_only");
    }

    notes.unshift("lock_surface=7 entry points (start/check/install), getter-setters untouched");
    notes.unshift("spoof_target=" + (REPORTED_FULL_VERSION || "disabled"));
    report(installed > 0 ? "installed" : "partial");
}

function probeAccountInfoAfterLogin() {
    var attempts = 0;
    var maxAttempts = 60;
    var timer = setInterval(function() {
        attempts++;
        try {
            var info = readAccountInfoFromProcessMemory();
            if (info && info.wxid) {
                publishAccountInfo(info);
            }
            if (attempts >= maxAttempts) {
                clearInterval(timer);
            }
        } catch (e) {
            console.error("[-] Account info probe failed: " + e);
            if (attempts >= maxAttempts) {
                clearInterval(timer);
            }
        }
    }, 2000);
}

function publishAccountInfo(info) {
    if (!info || !info.wxid) {
        return false;
    }
    var key = [
        info.wxid || "",
        info.nickname || "",
        info.phone || "",
        info.region || "",
        info.account_dir || "",
        info.data_path || ""
    ].join("|");
    if (key === accountInfoSentKey) {
        return false;
    }
    accountInfoSentKey = key;
    info.type = "account_info";
    info.user_id = info.wxid;
    send(info);
    console.log("[+] Account info detected: " + info.wxid +
        (info.nickname ? " nickname_ready" : "") +
        (info.phone ? " phone_ready" : ""));
    return true;
}

function mergeSelfProfile(prev, next) {
    if (!next) {
        return prev;
    }
    if (!prev) {
        return next;
    }
    var out = {};
    var keys = ["wxid", "alias", "nickname", "phone", "country", "province", "city", "region", "platform", "profile_base", "source", "detected_at"];
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        out[k] = (next[k] !== undefined && next[k] !== null && next[k] !== "") ? next[k] : prev[k];
    }
    // rebuild region if parts improved
    var regionParts = [];
    if (out.country) regionParts.push(out.country);
    if (out.province) regionParts.push(out.province);
    if (out.city) regionParts.push(out.city);
    if (regionParts.length) {
        out.region = regionParts.join("/");
    }
    return out;
}

function profilePhoneReady(profile) {
    return !!(profile && profile.phone && String(profile.phone).length >= 6);
}

function attachProfileReader() {
    if (profileReaderHookInstalled) {
        return;
    }
    if (!profileReaderAddr || profileReaderAddr.isNull()) {
        console.log("[!] Profile reader offset missing, account info will use memory scan fallback.");
        return;
    }
    profileReaderHookInstalled = true;
    try {
        console.log("[+] Profile reader hook target: " + profileReaderAddr + " offset=" + relOff(profileReaderAddr));
        profileReaderListener = registerHookListener("profile_reader", Interceptor.attach(profileReaderAddr, {
            onEnter: function() {
                if (!enterHook("profile_reader")) return;
                this.__zmybotGuarded = true;
                this.profileOutPtr = this.context.x8;
                leaveHook();
            },
            onLeave: function() {
                if (!this.__zmybotGuarded) return;
                this.__zmybotGuarded = false;
                if (!enterHook("profile_reader_leave")) return;
                try {
                var profile = readProfileFromReaderOut(this.profileOutPtr, "profile_reader_hook");
                if (!profile || !profile.wxid) {
                    return;
                }
                var beforePhone = cachedSelfProfile ? cachedSelfProfile.phone : "";
                cachedSelfProfile = mergeSelfProfile(cachedSelfProfile, profile);
                if (!profileReaderReadyLogged) {
                    profileReaderReadyLogged = true;
                    profileReaderFirstHitAt = Date.now();
                    console.log("[+] Profile reader ready.");
                    // 如实上报「这个 hook 真的命中过」。
                    //
                    // 为什么必须单独上报：状态接口里的 recv_hook_ready /
                    // text_hook_ready 之类只是 attached 的镜像，不代表任何
                    // 单个 hook 真的挂上或真的被触发过 —— 之前就是靠这盏假绿灯
                    // 让「接入成功、状态全绿、但昵称手机号永远为空」变得不可见。
                    // profile reader 是唯一会主动带资料回来的 hook，所以它
                    // 命中与否必须能被上层看见。
                    send({
                        type: "profile_reader_ready",
                        pid: Process.id,
                        has_phone: profilePhoneReady(cachedSelfProfile)
                    });
                    // phone/city/province may late-fill on same struct; keep hook briefly
                    setTimeout(function() {
                        if (!profileReaderDetached) {
                            detachProfileReader("late-fill window elapsed");
                        }
                    }, PROFILE_READER_LATE_FILL_MS);
                }
                publishAccountInfo(cachedSelfProfile);
                if (profilePhoneReady(cachedSelfProfile) && cachedSelfProfile.phone !== beforePhone) {
                    console.log("[+] Profile phone filled: " + cachedSelfProfile.phone);
                }
                if (profilePhoneReady(cachedSelfProfile) && cachedSelfProfile.city && cachedSelfProfile.province) {
                    detachProfileReader("profile phone/region captured");
                }
                } finally { leaveHook(); }
            }
        }));
    } catch (e) {
        console.error("[-] Profile reader hook failed: " + e);
    }
}

function detachProfileReader(reason) {
    if (profileReaderDetached || !profileReaderListener) {
        return;
    }
    profileReaderDetached = true;
    setTimeout(function() {
        try {
            profileReaderListener.detach();
            profileReaderListener = null;
            console.log("[+] Profile reader detached: " + reason);
        } catch (e) {
            console.error("[-] Profile reader detach failed: " + e);
        }
    }, 0);
}

function readCachedSelfProfile() {
    if (!cachedSelfProfile) {
        return null;
    }
    return cachedSelfProfile;
}

function readProfileFromReaderOut(outPtr, source) {
    try {
        if (!outPtr || outPtr.isNull() || !Process.findRangeByAddress(outPtr)) {
            return null;
        }
        var dataPtr = safeReadPointer(outPtr.add(8));
        if (!dataPtr || dataPtr.isNull() || !Process.findRangeByAddress(dataPtr)) {
            return null;
        }
        return parseProfileStruct(dataPtr.sub(8), source);
    } catch (e) {
        return null;
    }
}

function parseProfileStruct(profileBase, source) {
    if (!profileBase || profileBase.isNull() || !Process.findRangeByAddress(profileBase)) {
        return null;
    }
    var wxid = readUtf8CStringSafe(profileBase.add(PROFILE_STRUCT_LAYOUT.wxid), 64);
    var alias = readUtf8CStringSafe(profileBase.add(PROFILE_STRUCT_LAYOUT.alias), 64);
    var nickname = readUtf8CStringSafe(profileBase.add(PROFILE_STRUCT_LAYOUT.nickname), 64);
    var phone = readUtf8CStringSafe(profileBase.add(PROFILE_STRUCT_LAYOUT.phone), 32);
    var city = readUtf8CStringSafe(profileBase.add(PROFILE_STRUCT_LAYOUT.city), 64);
    var province = readUtf8CStringSafe(profileBase.add(PROFILE_STRUCT_LAYOUT.province), 64);
    var country = readUtf8CStringSafe(profileBase.add(PROFILE_STRUCT_LAYOUT.country), 64);
    var platform = readUtf8CStringSafe(profileBase.add(PROFILE_STRUCT_LAYOUT.platform), 64);

    if (!wxid || wxid.indexOf("wxid_") !== 0) {
        return null;
    }
    if (nickname && !looksLikeAccountNickname(nickname)) {
        nickname = "";
    }
    var regionParts = [];
    if (country) regionParts.push(country);
    if (province) regionParts.push(province);
    if (city) regionParts.push(city);
    return {
        wxid: wxid,
        alias: alias,
        nickname: nickname,
        phone: phone,
        country: country,
        province: province,
        city: city,
        region: regionParts.join("/"),
        platform: platform,
        profile_base: profileBase.toString(),
        source: source || "profile_reader",
        detected_at: Date.now()
    };
}

function readSsoField(addr) {
    try {
        var raw = new Uint8Array(addr.readByteArray(24));
        var size = raw[23];
        if (size === 0 || size > 23) return "";
        var text = (addr.readUtf8String(size) || "").replace(/^\s+|\s+$/g, "");
        if (!text) return "";
        var bytes = 0;
        for (var i = 0; i < text.length; i++) {
            var c = text.charCodeAt(i);
            bytes += c < 0x80 ? 1 : (c < 0x800 ? 2 : 3);
        }
        return bytes === size ? text : "";
    } catch (e) {
        return "";
    }
}

function readSelfProfileAnchored(wxid) {
    if (!wxid) return null;
    var pattern = asciiPattern(wxid);
    var ranges = Process.enumerateRanges({ protection: "rw-", coalesce: true });
    var checked = 0;
    for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i];
        if (!range || range.size <= 0 || range.size > 64 * 1024 * 1024) continue;
        var hits;
        try {
            hits = Memory.scanSync(range.base, range.size, pattern);
        } catch (e) {
            continue;
        }
        for (var j = 0; j < hits.length && checked < 256; j++) {
            checked++;
            var addr = hits[j].address;
            try {
                var head = new Uint8Array(addr.readByteArray(24));
                if (head[23] !== wxid.length) continue;
                if (readSsoField(addr) !== wxid) continue;
                var nickname = readSsoField(addr.add(0x30));
                if (!looksLikeAccountNickname(nickname)) continue;
                var alias = readSsoField(addr.add(0x18));
                var phone = readSsoField(addr.add(0x48));
                if (!/^[A-Za-z][A-Za-z0-9_-]{1,19}$/.test(alias)) alias = "";
                if (!/^[0-9]{6,20}$/.test(phone)) phone = "";
                var country = readSsoField(addr.add(0xd8));
                var province = readSsoField(addr.add(0xb0));
                var city = readSsoField(addr.add(0x98));
                var regionParts = [];
                if (/^[A-Za-z]{2}$/.test(country)) regionParts.push(country);
                if (province && province.length <= 24) regionParts.push(province);
                if (city && city.length <= 24) regionParts.push(city);
                return {
                    wxid: wxid,
                    alias: alias,
                    nickname: nickname,
                    phone: phone,
                    region: regionParts.join("/"),
                    country: /^[A-Za-z]{2}$/.test(country) ? country : "",
                    province: province || "",
                    city: city || "",
                    source: "frida_profile_sso",
                    profile_base: addr.sub(0x48).toString(),
                    detected_at: Date.now()
                };
            } catch (e) {
                continue;
            }
        }
        if (checked >= 256) break;
    }
    return null;
}


// 账号资料在本版本上只有一个可靠来源：profile reader hook 的主动上报
// （见 attachProfileReader）。这里只读它已经填好的缓存，不再自己猜内存结构。
//
// 为什么不再自己扫（2026-10-01 在已登录稳定的 WeChat pid 24012 上实测）：
//   - 旧的 readLoggedInProfileLight() 读硬编码全局 0x9c7d908。实测那里躺的是
//     补丁/ABI 描述符（"UnifiedPatch26 Mac 6.1 arm64"、"Mac OS 6.5.2"），不是
//     SSO 用户对象，obj+0x68 恒为 NULL —— 永远静默返回 null。它属于「不校验
//     就猜偏移」，已删除。
//   - readSelfProfileAnchored() 命中的是 wxid 字符串副本（间隔 0x40 重复），
//     ±0x100 字节内没有昵称/别名/手机号，所以永远走不到返回点。
//   - 磁盘侧 contact.db 是 SQLCipher 加密、key_info.db 只有 md5 密钥，同样读不到。
//
// 结论：昵称/手机号只能等微信自己调用 profile reader 时才有值；wxid 与头像由宿主
// 从本地账号目录兜底（account.rs::apply_local）。所以「暂时没抓到昵称」是预期
// 状态而不是故障 —— 别再为了补它加新的硬编码偏移。
//
// 注意门禁从「wxid 且 nickname」放宽到「只要 wxid」：昵称常常晚于 wxid 填充，
// 早一步上报能让状态里的 source 如实变成 profile_reader，Rust 侧 fill() 只在
// 非空时覆盖，不会把本地兜底值冲掉。
function readAccountInfoFromProcessMemory() {
    if (globalThis.__zmybotQuitting) return null;
    var cached = readCachedSelfProfile();
    if (cached && cached.wxid) {
        return {
            wxid: cached.wxid,
            alias: cached.alias || "",
            nickname: cached.nickname || "",
            phone: cached.phone || "",
            region: cached.region || "",
            country: cached.country || "",
            province: cached.province || "",
            city: cached.city || "",
            platform: cached.platform || "",
            account_dir: "",
            data_path: "",
            process_id: String(Process.id),
            source: cached.source || "profile_reader",
            profile_base: cached.profile_base || "",
            detected_at: cached.detected_at || Date.now()
        };
    }
    // 内存扫描兜底：实测既慢又读不到，保持关闭。理由见 ENABLE_PROFILE_MEMORY_FALLBACK。
    if (!ENABLE_PROFILE_MEMORY_FALLBACK) {
        return null;
    }
    var account = findLoggedInAccountFromPaths();
    if (!account || !account.wxid) {
        return null;
    }
    var profile = findAccountProfileDetails(account.wxid) || {};
    return {
        wxid: account.wxid,
        nickname: profile.nickname || "",
        phone: profile.phone || "",
        region: profile.region || "",
        account_dir: account.accountDir,
        data_path: account.dataPath,
        process_id: String(Process.id),
        source: profile.source || (profile.nickname ? "frida_profile_memory" : "frida_memory"),
        detected_at: Date.now()
    };
}

function findAccountProfileDetails(wxid) {
    var wxidSuffix = "";
    if (wxid && wxid.length >= 5) {
        wxidSuffix = wxid.slice(-5);
    }
    var account = findLoggedInAccountFromPaths();
    var best = null;
    var bestScore = 0;

    if (account) {
        best = scanAccountProfileNearPath(account, wxidSuffix);
        if (best) {
            bestScore = best.score;
            if (bestScore >= 8) {
                best.source = "frida_profile_near_path";
                return accountProfileResult(best);
            }
        }
    }

    var nearWxid = scanAccountProfileNearWxid(wxid, wxidSuffix);
    if (nearWxid && nearWxid.score > bestScore) {
        best = nearWxid;
        bestScore = nearWxid.score;
        if (bestScore >= 8) {
            best.source = "frida_profile_near_wxid";
            return accountProfileResult(best);
        }
    }

    var ranges = Process.enumerateRanges({ protection: "rw-", coalesce: true });
    for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i];
        if (range.size <= 0 || range.size > 32 * 1024 * 1024) {
            continue;
        }
        var hits;
        try {
            hits = Memory.scanSync(range.base, range.size, "1a ?? 0a ??");
        } catch (e) {
            continue;
        }
        for (var j = 0; j < hits.length; j++) {
            var candidate = parseAccountProfileCandidate(hits[j].address, wxidSuffix);
            if (candidate && candidate.score > bestScore) {
                best = candidate;
                bestScore = candidate.score;
                if (bestScore >= 8) {
                    best.source = "frida_profile_pattern";
                    return accountProfileResult(best);
                }
            }
        }
    }

    if (!best || !best.nickname || bestScore < 4) {
        return null;
    }
    if (!best.source) {
        best.source = "frida_profile_memory";
    }
    return accountProfileResult(best);
}

function accountProfileResult(profile) {
    return {
        nickname: profile.nickname,
        phone: profile.phone,
        region: profile.region,
        source: profile.source
    };
}

function scanAccountProfileNearPath(account, wxidSuffix) {
    if (!account || !account.pathAddress || !account.rangeBase || !account.rangeSize) {
        return null;
    }
    var rangeBase = account.rangeBase;
    var rangeEnd = account.rangeBase.add(account.rangeSize);
    var start = account.pathAddress.sub(8192);
    if (start.compare(rangeBase) < 0) {
        start = rangeBase;
    }
    var end = account.pathAddress.add(32768);
    if (end.compare(rangeEnd) > 0) {
        end = rangeEnd;
    }
    return scanAccountProfileWindow(start, end, wxidSuffix);
}

function scanAccountProfileNearWxid(wxid, wxidSuffix) {
    if (!wxid) {
        return null;
    }
    var wxidPattern = asciiPattern(wxid);
    var ranges = Process.enumerateRanges({ protection: "rw-", coalesce: true });
    var best = null;
    for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i];
        if (range.size <= 0 || range.size > 32 * 1024 * 1024) {
            continue;
        }
        var hits;
        try {
            hits = Memory.scanSync(range.base, range.size, wxidPattern);
        } catch (e) {
            continue;
        }
        for (var j = 0; j < hits.length; j++) {
            var start = hits[j].address.sub(4096);
            if (start.compare(range.base) < 0) {
                start = range.base;
            }
            var end = hits[j].address.add(8192);
            var rangeEnd = range.base.add(range.size);
            if (end.compare(rangeEnd) > 0) {
                end = rangeEnd;
            }
            var candidate = scanAccountProfileWindow(start, end, wxidSuffix);
            if (candidate && (!best || candidate.score > best.score)) {
                best = candidate;
                if (best.score >= 8) {
                    return best;
                }
            }
        }
    }
    return best;
}

function scanAccountProfileWindow(start, end, wxidSuffix) {
    var size = end.sub(start).toInt32();
    if (size <= 4 || size > 128 * 1024) {
        return null;
    }
    var bytes = readRawBytesSafe(start, size);
    var best = null;
    for (var i = 0; i < bytes.length - 4; i++) {
        if (bytes[i] !== 0x1a || bytes[i + 2] !== 0x0a) {
            continue;
        }
        var candidate = parseAccountProfileCandidate(start.add(i), wxidSuffix);
        if (candidate && (!best || candidate.score > best.score)) {
            best = candidate;
        }
    }
    return best;
}

function parseAccountProfileCandidate(address, wxidSuffix) {
    var nestedTag;
    var nestedLen;
    var valueLen;
    try {
        nestedTag = address.readU8();
        nestedLen = address.add(1).readU8();
        if (nestedTag !== 0x1a || nestedLen < 3 || nestedLen > 64) {
            return null;
        }
        if (address.add(2).readU8() !== 0x0a) {
            return null;
        }
        valueLen = address.add(3).readU8();
        if (valueLen <= 0 || valueLen > 48 || valueLen + 2 > nestedLen) {
            return null;
        }
    } catch (e) {
        return null;
    }

    var nickname = readUtf8BytesSafe(address.add(4), valueLen);
    if (!looksLikeAccountNickname(nickname)) {
        return null;
    }

    var context = readRawBytesSafe(address.sub(180), 420);
    var contextText = bytesToLooseText(context);
    if (isRejectedAccountProfileContext(nickname, contextText)) {
        return null;
    }
    var score = 3;
    if (wxidSuffix && contextText.indexOf(wxidSuffix) >= 0) {
        score += 3;
    }
    var phone = extractNestedDigitField(context);
    if (phone) {
        score += 2;
    }
    var region = extractAsciiFieldAfterTag(context, 0x5a);
    if (region) {
        score += 1;
    }
    if (contextText.indexOf("wxid_") >= 0) {
        score += 1;
    }

    return {
        nickname: nickname,
        phone: phone,
        region: region,
        score: score
    };
}

function isRejectedAccountProfileContext(nickname, contextText) {
    if (!contextText) {
        return false;
    }
    if (contextText.indexOf("<nickname>") >= 0 || contextText.indexOf("</TimelineObject>") >= 0 || contextText.indexOf("<SnsDataItem") >= 0) {
        return true;
    }
    if (nickname && (contextText.indexOf("@" + nickname) >= 0 || contextText.indexOf(": @") >= 0)) {
        return true;
    }
    if (contextText.indexOf("@chatroom") >= 0 || contextText.indexOf("db_storage/message") >= 0 || contextText.indexOf("message_manager.cc") >= 0 || contextText.indexOf("AsyncCheckStorage") >= 0) {
        return true;
    }
    if (contextText.indexOf("_Skia_") >= 0 || contextText.indexOf("ProxyProvider_") >= 0 || contextText.indexOf("MakeSurfaceDrawContext") >= 0) {
        return true;
    }
    return false;
}

function looksLikeAccountNickname(value) {
    if (!value) {
        return false;
    }
    if (value.indexOf("wxid_") === 0 || value.indexOf("@chatroom") >= 0) {
        return false;
    }
    if (value.indexOf(":") >= 0 || value.indexOf("@") >= 0 || value.indexOf("[") >= 0 || value.indexOf("]") >= 0) {
        return false;
    }
    if (value.length > 24) {
        return false;
    }
    return /[\u4e00-\u9fffA-Za-z0-9]/.test(value);
}

function readRawBytesSafe(address, length) {
    try {
        var bytes = address.readByteArray(length);
        return bytes ? new Uint8Array(bytes) : new Uint8Array(0);
    } catch (e) {
        return new Uint8Array(0);
    }
}

function isReadableBuffer(address, length) {
    try {
        if (!address || address.isNull() || length <= 0) {
            return false;
        }
        var range = Process.findRangeByAddress(address);
        if (!range || range.protection.indexOf("r") < 0) {
            return false;
        }
        var end = address.add(length - 1);
        return end.compare(range.base.add(range.size)) < 0;
    } catch (e) {
        return false;
    }
}

// [address, address+length) 是否完整落在同一个**可写**内存区间内。
//
// 发送路径要往微信自己的 StartTask 载荷结构体里写 cgi 指针和 proto 字节，
// 这块内存不是我们分配的：写超界就是踩进相邻对象的堆内存（堆破坏，表现是延迟崩溃），
// 指针失效后写就是 use-after-free。两者都不是 read 检查能挡住的，所以要单独判可写。
function isWritableBuffer(address, length) {
    try {
        if (!address || address.isNull() || length <= 0) {
            return false;
        }
        var range = Process.findRangeByAddress(address);
        if (!range || range.protection.indexOf("w") < 0) {
            return false;
        }
        var end = address.add(length - 1);
        return end.compare(range.base.add(range.size)) < 0;
    } catch (e) {
        return false;
    }
}

function isReadablePointer(address) {
    return isReadableBuffer(address, Process.pointerSize);
}

function safeReadPointer(address) {
    try {
        if (!isReadablePointer(address)) {
            return ptr(0);
        }
        return address.readPointer();
    } catch (e) {
        return ptr(0);
    }
}

function readPointerIfReadable(address) {
    var value = safeReadPointer(address);
    if (!isReadablePointer(value)) {
        return ptr(0);
    }
    return value;
}

function readByteArrayIfReadable(address, length) {
    try {
        if (!isReadableBuffer(address, length)) {
            return null;
        }
        return address.readByteArray(length);
    } catch (e) {
        return null;
    }
}

function readUtf8StringIfReadable(address) {
    if (!isReadablePointer(address)) {
        return "";
    }
    return readUtf8CStringSafe(address, 4096);
}


function readUtf8CStringSafe(address, maxLen) {
    var bytes = readRawBytesSafe(address, maxLen);
    if (bytes.length === 0) {
        return "";
    }
    var real = [];
    for (var i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) {
            break;
        }
        real.push(bytes[i]);
    }
    if (real.length === 0) {
        return "";
    }
    var encoded = "";
    for (var j = 0; j < real.length; j++) {
        encoded += "%" + real[j].toString(16).padStart(2, "0");
    }
    try {
        return decodeURIComponent(encoded);
    } catch (e) {
        var text = "";
        for (var k = 0; k < real.length; k++) {
            var b = real[k];
            text += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : "";
        }
        return text;
    }
}

function readUtf8BytesSafe(address, length) {
    var bytes = readRawBytesSafe(address, length);
    if (bytes.length === 0) {
        return "";
    }
    var encoded = "";
    for (var i = 0; i < bytes.length; i++) {
        encoded += "%" + bytes[i].toString(16).padStart(2, "0");
    }
    try {
        return decodeURIComponent(encoded);
    } catch (e) {
        return "";
    }
}

function bytesToLooseText(bytes) {
    var text = "";
    for (var i = 0; i < bytes.length; i++) {
        var b = bytes[i];
        text += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : " ";
    }
    return text.replace(/\s+/g, " ").trim();
}

function extractNestedDigitField(bytes) {
    for (var i = 0; i < bytes.length - 4; i++) {
        if (bytes[i] !== 0x32 || bytes[i + 2] !== 0x0a) {
            continue;
        }
        var nestedLen = bytes[i + 1];
        var valueLen = bytes[i + 3];
        if (nestedLen < 3 || nestedLen > 32 || valueLen <= 0 || valueLen > 20 || i + 4 + valueLen > bytes.length) {
            continue;
        }
        var value = "";
        var valid = true;
        for (var j = 0; j < valueLen; j++) {
            var b = bytes[i + 4 + j];
            if (b < 0x30 || b > 0x39) {
                valid = false;
                break;
            }
            value += String.fromCharCode(b);
        }
        if (valid && value.length >= 5) {
            return value;
        }
    }
    return "";
}

function extractAsciiFieldAfterTag(bytes, tag) {
    for (var i = 0; i < bytes.length - 2; i++) {
        if (bytes[i] !== tag) {
            continue;
        }
        var length = bytes[i + 1];
        if (length <= 0 || length > 32 || i + 2 + length > bytes.length) {
            continue;
        }
        var value = "";
        var valid = true;
        for (var j = 0; j < length; j++) {
            var b = bytes[i + 2 + j];
            if (b < 0x20 || b > 0x7e) {
                valid = false;
                break;
            }
            value += String.fromCharCode(b);
        }
        if (valid) {
            return value;
        }
    }
    return "";
}


function findLoggedInAccountFromPaths() {
    var ranges = Process.enumerateRanges({ protection: "rw-", coalesce: true });
    var marker = "/xwechat_files/wxid_";
    var pattern = asciiPattern(marker);
    var candidates = [];

    for (var i = 0; i < ranges.length; i++) {
        var range = ranges[i];
        if (range.size <= 0 || range.size > 32 * 1024 * 1024) {
            continue;
        }
        var hits;
        try {
            hits = Memory.scanSync(range.base, range.size, pattern);
        } catch (e) {
            continue;
        }
        for (var j = 0; j < hits.length; j++) {
            var hit = hits[j].address.add("/xwechat_files/".length);
            var text = readCStringSafe(hit, 160);
            var match = text.match(/^(wxid_[A-Za-z0-9]+)_[A-Za-z0-9]+/);
            if (match && match[1]) {
                candidates.push({
                    wxid: match[1],
                    accountDir: text.split("/")[0],
                    dataPath: readXwechatFilesRoot(hits[j].address),
                    pathAddress: hits[j].address,
                    rangeBase: range.base,
                    rangeSize: range.size
                });
            }
        }
    }

    return candidates.length > 0 ? candidates[0] : null;
}

function readXwechatFilesRoot(markerAddress) {
    try {
        var start = markerAddress.sub(128);
        var text = readCStringSafe(start, 320);
        var idx = text.indexOf("/xwechat_files/");
        if (idx < 0) {
            return "";
        }
        return text.slice(0, idx + "/xwechat_files".length);
    } catch (e) {
        return "";
    }
}

function asciiPattern(value) {
    var bytes = [];
    for (var i = 0; i < value.length; i++) {
        bytes.push(value.charCodeAt(i).toString(16).padStart(2, "0"));
    }
    return bytes.join(" ");
}

function readCStringSafe(address, maxLen) {
    try {
        var bytes = address.readByteArray(maxLen);
        if (!bytes) return "";
        var u8 = new Uint8Array(bytes);
        var result = "";
        for (var i = 0; i < u8.length; i++) {
            if (u8[i] === 0) break;
            result += String.fromCharCode(u8[i]);
        }
        return result;
    } catch (e) {
        return "";
    }
}

// -------------------------基础函数分区-------------------------
function hexToByteArray(hexStr) {
    var bytes = [];
    for (var i = 0; i < hexStr.length; i += 2) {
        bytes.push(parseInt(hexStr.substr(i, 2), 16));
    }
    return bytes;
}

function patchString(addr, plainStr) {
    const bytes = [];
    for (let i = 0; i < plainStr.length; i++) {
        bytes.push(plainStr.charCodeAt(i));
    }

    addr.writeByteArray(bytes);
    addr.add(bytes.length).writeU8(0);
}

function generateAESKey() {
    const chars = 'abcdef0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

function fillUploadX1AndStart(taskId, idAddr, pathAddr, x1Buffer, receiver, md5, filePath, payloadHex) {
    if (uploadGlobalX0.equals(ptr(0))) {
        console.error("[!] uploadGlobalX0 尚未初始化，请等待 hook 捕获");
        return "fail";
    }

    const payload = hexToByteArray(payloadHex);
    const fileId = receiver + "_" + String(Math.floor(Date.now() / 1000)) + "_" + Math.floor(Math.random() * 1001) + "_1";
    patchString(idAddr, fileId);
    patchString(md5Addr, md5);
    patchString(uploadAesKeyAddr, generateAESKey());
    patchString(pathAddr, filePath);

    x1Buffer.writeByteArray(payload);
    x1Buffer.writePointer(uploadFunc1Addr);
    x1Buffer.add(0x08).writePointer(uploadFunc2Addr);
    x1Buffer.add(0x48).writePointer(idAddr);
    x1Buffer.add(0x68).writeUtf8String(receiver);
    x1Buffer.add(0xa8).writePointer(md5Addr);
    x1Buffer.add(0xe8).writePointer(pathAddr);
    x1Buffer.add(0x118).writePointer(pathAddr);
    x1Buffer.add(0x148).writePointer(pathAddr);
    x1Buffer.add(0x200).writePointer(uploadAesKeyAddr);

    if (taskId !== undefined && taskId !== null && taskId !== "") {
        uploadTaskByFileId[fileId] = Number(taskId);
    }

    const startUploadMedia = new NativeFunction(uploadImageAddr, 'int64', ['pointer', 'pointer']);
    return startUploadMedia(uploadGlobalX0, x1Buffer);
}

function resolveUploadTaskId(fileId) {
    if (!fileId) {
        return 0;
    }
    if (Object.prototype.hasOwnProperty.call(uploadTaskByFileId, fileId)) {
        const taskId = uploadTaskByFileId[fileId];
        delete uploadTaskByFileId[fileId];
        return Number(taskId) || 0;
    }
    return 0;
}

// -------------------------基础函数分区-------------------------

// -------------------------全局变量分区-------------------------

// 文本消息全局变量 (new_text.js approach)
var blrX8Addr;
var autoBufferWriteFunc;
var textCgiAddr = ptr(0);
var sendTextMessageAddr = ptr(0);
var textMessageAddr = ptr(0);
var sendMessageCallbackFunc;
var retOneStub = ptr(0);
var fakeVtable = ptr(0);
var pendingInsertMsgAddr = ptr(0);  // 等待buf2resp后清理的insertMsgAddr
var pendingSendMsgType = "";  // 等待buf2resp回调时使用的消息类型
var pendingBuf2RespTaskId = 0;  // 等待buf2resp匹配的taskId
var textProtoDataAddr = ptr(0);


// 双方公共使用的地址
var triggerX1Payload;
var triggerX0;
var req2bufEnterAddr;
var req2bufExitAddr;
var sendFuncAddr;
var insertMsgAddr = ptr(0);
var sendMsgType = "";
var buf2RespAddr;

var uploadImageAddr;
var cndOnCompleteAddr;
var imgMessageCallbackFunc;

var uploadGetCallbackWrapperAddr;
var uploadGetCallbackWrapperFuncAddr;
var uploadOnCompleteAddr;
var uploadOnCompleteFuncAddr;

var uploadImageX1 = ptr(0);
var imgCgiAddr = ptr(0);
var sendImgMessageAddr = ptr(0);
var imgMessageAddr = ptr(0);
var uploadGlobalX0 = ptr(0)
var uploadFunc1Addr = ptr(0)
var uploadFunc2Addr = ptr(0)
var imageIdAddr = ptr(0)
var md5Addr = ptr(0)
var uploadAesKeyAddr = ptr(0)
var ImagePathAddr1 = ptr(0)
var uploadCallback = ptr(0)
var uploadTaskByFileId = {};

// [已删除 triggerSendVideoMessage / triggerUploadVideo] videoCgiAddr / sendVideoMessageAddr /
// videoMessageAddr / uploadVideoX1 / videoPathAddr1 只服务于已删除的视频 trigger 链路。
var videoIdAddr = ptr(0);

// 语音消息全局变量
// [已删除 triggerSendVoiceMessage / triggerUploadVoice] voiceCgiAddr / sendVoiceMessageAddr /
// voiceMessageAddr / uploadVoiceX1 / voicePathAddr1 / voiceProtoHexGlobal / voiceAudioDataAddr
// 全部只被这两条已删除的 trigger 链路引用，一并清掉。
var voiceIdAddr = ptr(0);


// 发送消息的全局变量
var taskIdGlobal = 0x20000090 // 最好比较大，不和原始的微信消息重复
var accountInfoSentKey = "";
var profileReaderAddr;
var profileReaderHookInstalled = false;
var profileReaderListener = null;
var profileReaderDetached = false;
var profileReaderReadyLogged = false;
var profileReaderFirstHitAt = 0;
var PROFILE_READER_LATE_FILL_MS = 15000;
var cachedSelfProfile = null;


var PROFILE_STRUCT_LAYOUT = {
    wxid: 0x68,
    alias: 0x80,
    nickname: 0x98,
    phone: 0xb0,
    city: 0x100,
    province: 0x118,
    country: 0x140,
    platform: 0x180
};

// 文本消息protobuf全局变量 (从Go直接传入hex编码)
var textProtoHexGlobal = "";
// 图片消息protobuf全局变量 (从Go直接传入hex编码)
var imgProtoHexGlobal = "";
// 视频 / 回复消息的 protobuf 全局变量已随对应 trigger 删除，见下方说明。
// 文件消息protobuf全局变量 (从Go直接传入hex编码)
var fileProtoHexGlobal = "";
// [已删除] videoProtoHexGlobal / replyProtoHexGlobal / voiceProtoHexGlobal /
// fileUploadProtoHexGlobal：attachBlrX8Hook 里的对应分支与 msgAddrInfo 的对应分派项
// 随 4 条已删除的 trigger 一起失效，故一并移除。

// 文件消息全局变量
var fileCgiAddr = ptr(0);
var sendFileMessageAddr = ptr(0);
var fileMessageAddr = ptr(0);
var uploadFileIdAddr = ptr(0);
var uploadFileX1 = ptr(0);



// -------------------------全局变量分区-------------------------


function AttachSendFunc() {
    if (!sendFuncAddr || sendFuncAddr.isNull()) {
        console.error("[-] sendFuncAddr missing, skip AttachSendFunc");
        return;
    }
    registerHookListener("start_task", Interceptor.attach(sendFuncAddr.add(0x10), {
        onEnter: function (args) {
            if (!enterHook("start_task")) return;
            try {
                if (triggerX1Payload) {
                    return
                }

                triggerX0 = this.context.x0;
                triggerX1Payload = this.context.x1;
                console.log(`[+] 捕获到 StartTask 调用，X0：${triggerX0}, Payload: ${triggerX1Payload}`);
            } finally { leaveHook(); }
        }
    }))
}

// -------------------------发送文本消息分区-------------------------
// 初始化进行内存的分配
function setupSendTextMessageDynamic() {
    // 动态分配内存

    textCgiAddr = Memory.alloc(128);
    sendTextMessageAddr = Memory.alloc(256);
    textMessageAddr = Memory.alloc(256);
    textProtoDataAddr = Memory.alloc(4096);

    // A. 写入字符串内容
    patchString(textCgiAddr, "/cgi-bin/micromsg-bin/newsendmsg");

    // B. 构建 sendTextMessageAddr 结构体 (X24 基址位置)
    sendTextMessageAddr.add(0x00).writeU64(0);
    sendTextMessageAddr.add(0x08).writeU64(0);
    sendTextMessageAddr.add(0x10).writeU64(0);
    sendTextMessageAddr.add(0x18).writeU64(1);
    sendTextMessageAddr.add(0x20).writeU32(taskIdGlobal);
    sendTextMessageAddr.add(0x28).writePointer(textMessageAddr);

    // C. 构建 Message 结构体
    textMessageAddr.add(0x00).writePointer(fakeVtable);
    textMessageAddr.add(0x08).writeU32(taskIdGlobal);
    textMessageAddr.add(0x0c).writeU32(0x20a);
    textMessageAddr.add(0x10).writeU64(0x3);
    textMessageAddr.add(0x18).writePointer(textCgiAddr);
    textMessageAddr.add(0x20).writeU64(uint64("0x20"));

    console.log("[+] Dynamic Text Message Setup Complete.");
}


// -------------------------发送文件消息分区-------------------------
function setupSendFileMessageDynamic() {
    fileCgiAddr = Memory.alloc(128);
    sendFileMessageAddr = Memory.alloc(256);
    fileMessageAddr = Memory.alloc(256);
    uploadFileIdAddr = Memory.alloc(128);
    uploadFileX1 = Memory.alloc(1024);
    patchString(uploadFileIdAddr, "file_upload_not_init");

    patchString(fileCgiAddr, "/cgi-bin/micromsg-bin/sendappmsg");

    sendFileMessageAddr.add(0x00).writeU64(0);
    sendFileMessageAddr.add(0x08).writeU64(0);
    sendFileMessageAddr.add(0x10).writeU64(0);
    sendFileMessageAddr.add(0x18).writeU64(1);
    sendFileMessageAddr.add(0x20).writeU32(taskIdGlobal);
    sendFileMessageAddr.add(0x28).writePointer(fileMessageAddr);

    fileMessageAddr.add(0x00).writePointer(fakeVtable);
    fileMessageAddr.add(0x08).writeU32(taskIdGlobal);
    fileMessageAddr.add(0x0c).writeU32(0x6e);
    fileMessageAddr.add(0x10).writeU64(0x3);
    fileMessageAddr.add(0x18).writePointer(fileCgiAddr);
    fileMessageAddr.add(0x20).writeU64(0x20);
    fileMessageAddr.add(0x28).writeU64(uint64("0x8000000000000030"));
    fileMessageAddr.add(0x30).writeU64(uint64("0x0000000001010100"));
}

function triggerSendFileMessage(taskId, sender, receiver, protoHex, payloadHex) {
    return triggerSendMediaMessage(taskId, sender, receiver, protoHex, payloadHex, "file");
}

function triggerUploadFile(taskId, receiver, md5, filePath, payloadHex) {
    return fillUploadX1AndStart(taskId, uploadFileIdAddr, ImagePathAddr1, uploadFileX1, receiver, md5, filePath, payloadHex);
}



// -------------------------发送文件消息分区-------------------------



// 创建一个只返回1的小函数stub
function setupRetOneStub() {
    retOneStub = Memory.alloc(Process.pageSize);
    Memory.patchCode(retOneStub, 8, code => {
        // MOV W0, #1 = 0x52800020, RET = 0xD65F03C0 (little-endian)
        code.writeByteArray([0x20, 0x00, 0x80, 0x52, 0xC0, 0x03, 0x5F, 0xD6]);
    });
    console.log("[+] Return-1 stub created at: " + retOneStub);

    // 构造假vtable：所有槽位指向retOneStub，这样mars对我们伪造结构做虚调用时不会崩溃
    fakeVtable = Memory.alloc(512);
    for (var i = 0; i < 64; i++) {
        fakeVtable.add(i * 8).writePointer(retOneStub);
    }
    console.log("[+] Fake vtable created at: " + fakeVtable);
}

function attachBlrX8Hook() {
    if (!blrX8Addr || blrX8Addr.isNull() || !autoBufferWriteFunc || autoBufferWriteFunc.isNull()) {
        console.error("[-] BLR/autoBuffer offset missing, skip attachBlrX8Hook");
        return;
    }
    console.log("[+] Hooking BLR X8 at: " + blrX8Addr);

    var nativeAutoBufferWrite = new NativeFunction(autoBufferWriteFunc, 'int', ['pointer', 'pointer', 'int']);

    registerHookListener("blr_x8", Interceptor.attach(blrX8Addr, {
        onEnter: function(args) {
            if (!enterHook("blr_x8")) return;
            try {
            var currentTaskId = this.context.x20.toUInt32();
            if (currentTaskId !== taskIdGlobal) {
                return;
            }

            console.log("[+] BLR X8 命中! taskId=" + currentTaskId + " sendMsgType=" + sendMsgType);

            var autoBuffer = this.context.x1;
            var protoHex = "";

            if (sendMsgType === "text") {
                protoHex = textProtoHexGlobal;
            } else if (sendMsgType === "img") {
                protoHex = imgProtoHexGlobal;
            } else if (sendMsgType === "file") {
                protoHex = fileProtoHexGlobal;
            }

            if (!protoHex || protoHex.length === 0) {
                console.error("[!] protoHex 为空, sendMsgType=" + sendMsgType);
                return;
            }

            var finalPayload = hexToByteArray(protoHex);
            textProtoDataAddr.writeByteArray(finalPayload);

            // 调用 autoBufferWrite(autoBuffer, data, len) 填充 v133
            nativeAutoBufferWrite(autoBuffer, textProtoDataAddr, finalPayload.length);
            console.log("[+] autoBufferWrite 调用完成, protobuf长度: " + finalPayload.length);

            // 将 X8 指向 retOneStub，这样 BLR X8 只会返回1，不执行原始逻辑
            this.context.x8 = retOneStub;
            } finally { leaveHook(); }
        }
    }));
}

function triggerSendTextMessage(taskId, receiver, content, atUser, protoHex, payloadHex) {
    return triggerSendMediaMessage(taskId, "", receiver, protoHex, payloadHex, "text");
}

// 2026-09-29 移除转账确认抓包整块（原 2057-2069 的全局变量与 2367-2589 的 12 个函数，
// 含 installTransferConfirmCapture）。删除原因：该函数**从未被任何地方调用**，是逆向
// 探测阶段的遗留；对应的能力键 zmybot.transfer.confirm 也只有定义和向服务器申请，
// 全仓零调用点 —— 用户付费买的 是一个调用点不存在的能力。


// -------------------------发送文本消息分区-------------------------


// -------------------------Req2Buf公共部分分区-------------------------
function attachReq2buf() {
    if (!req2bufEnterAddr || req2bufEnterAddr.isNull() || !req2bufExitAddr || req2bufExitAddr.isNull()) {
        console.error("[-] req2buf offsets missing, skip attachReq2buf");
        return;
    }
    registerHookListener("req2buf_enter", Interceptor.attach(req2bufEnterAddr, {
        onEnter: function (args) {
            if (!enterHook("req2buf_enter")) return;
            try {
            if (!this.context.x1.equals(taskIdGlobal)) {
                return;
            }

            const x24_base = this.context.x24;
            insertMsgAddr = x24_base.add(0x60);

            if (sendMsgType === "text") {
                insertMsgAddr.writePointer(sendTextMessageAddr);
                console.log("[+] 发送文本消息成功! Req2Buf 已将 X24+0x60 指向新地址: " + sendTextMessageAddr +
                    "[+] Req2Buf 写入后内存预览: " + insertMsgAddr);
            } else if (sendMsgType === "img") {
                insertMsgAddr.writePointer(sendImgMessageAddr);
                console.log("[+] 发送图片消息成功! Req2Buf 已将 X24+0x60 指向新地址: " + sendImgMessageAddr +
                    "[+] Req2Buf 写入后内存预览: " + insertMsgAddr);
            // [已删除] video / reply / voice / fileupload 四个分支：对应的
            // sendVideoMessageAddr / sendReplyMessageAddr / sendVoiceMessageAddr /
            // sendFileUploadMessageAddr 已随未接线的 trigger 一并删除，且 sendMsgType
            // 永远不会再取这些值，保留即为死代码。
            } else if (sendMsgType === "file") {
                insertMsgAddr.writePointer(sendFileMessageAddr);
                console.log("[+] 发送文件消息成功! Req2Buf 已将 X24+0x60 指向新地址: " + sendFileMessageAddr +
                    "[+] Req2Buf 写入后内存预览: " + insertMsgAddr);
            }
            } finally { leaveHook(); }
        }
    }));

    // 在出口处拦截req2buf，记录insertMsgAddr等buf2resp回调后再清理
    registerHookListener("req2buf_exit", Interceptor.attach(req2bufExitAddr, {
        onEnter: function (args) {
            if (!enterHook("req2buf_exit")) return;
            try {
            if (!this.context.x25.equals(taskIdGlobal)) {
                return;
            }
            // 不立即清除insertMsgAddr，让mars能路由buf2resp回调
            // 用fakeVtable保护结构体，防止中间被访问时崩溃
            pendingInsertMsgAddr = insertMsgAddr;
            pendingSendMsgType = sendMsgType;
            pendingBuf2RespTaskId = taskIdGlobal;
            taskIdGlobal = 0;
            } finally { leaveHook(); }
        }
    }));
}


// -------------------------Req2Buf公共部分分区-------------------------

// -------------------------发送图片消息分区-------------------------

// 初始化进行内存的分配
function setupSendImgMessageDynamic() {

    // 1. 动态分配内存块（按需分配大小）
    // 分配原则：字符串给 64-128 字节，结构体按实际大小分配
    imgCgiAddr = Memory.alloc(128);
    sendImgMessageAddr = Memory.alloc(256);
    imgMessageAddr = Memory.alloc(256);
    uploadFunc1Addr = Memory.alloc(24);
    uploadFunc2Addr = Memory.alloc(24);
    uploadCallback = Memory.alloc(128);
    imageIdAddr = Memory.alloc(256);
    md5Addr = Memory.alloc(256);
    uploadAesKeyAddr = Memory.alloc(256);
    ImagePathAddr1 = Memory.alloc(256);
    uploadImageX1 = Memory.alloc(1024);

    // 图片数据写入
    patchString(imgCgiAddr, "/cgi-bin/micromsg-bin/uploadmsgimg");

    sendImgMessageAddr.add(0x00).writeU64(0);
    sendImgMessageAddr.add(0x08).writeU64(0);
    sendImgMessageAddr.add(0x10).writeU64(0);
    sendImgMessageAddr.add(0x18).writeU64(1);
    sendImgMessageAddr.add(0x20).writeU32(taskIdGlobal);
    sendImgMessageAddr.add(0x28).writePointer(imgMessageAddr);

    imgMessageAddr.add(0x00).writePointer(fakeVtable);
    imgMessageAddr.add(0x08).writeU32(taskIdGlobal);
    imgMessageAddr.add(0x0c).writeU32(0x6e);
    imgMessageAddr.add(0x10).writeU64(0x3);
    imgMessageAddr.add(0x18).writePointer(imgCgiAddr);
    imgMessageAddr.add(0x20).writeU64(0x22);
    imgMessageAddr.add(0x28).writeU64(uint64("0x8000000000000030"));
    imgMessageAddr.add(0x30).writeU64(uint64("0x0000000001010100"));

    // [已删除 triggerSendVideoMessage] 视频发送结构体 videoCgiAddr / sendVideoMessageAddr /
    // videoMessageAddr 随之删除：唯一消费者是 triggerSendMediaMessage 的 "video" 分派项，
    // 而该 trigger 在 Rust 侧引用数为 0。
    // videoIdAddr 必须保留：patchCdnOnComplete / attachGetCallbackFromWrapper 仍读它做
    // isManagedUpload 判定，图片与文件上传路径依赖这个比较，删掉会改变线上行为。
    videoIdAddr = Memory.alloc(256);

    // [已删除 triggerSendVoiceMessage / triggerUploadVoice] 语音发送结构体 voiceCgiAddr /
    // sendVoiceMessageAddr / voiceMessageAddr / uploadVoiceX1 / voiceAudioDataAddr 随之删除，
    // 理由同上：只服务于已删除的 "voice" 分派项与 triggerUploadVoice。
    // voiceIdAddr 同样必须保留，理由见上方 videoIdAddr 的注释。
    voiceIdAddr = Memory.alloc(256);
}



function triggerSendMediaMessage(taskId, sender, receiver, protoHex, payloadHex, msgType) {
    if (!taskId || !receiver) {
        console.error("[!] " + msgType + ": taskId or receiver is empty!");
        return "fail";
    }

    if (!triggerX0 || !triggerX1Payload) {
        console.error("[!] triggerX0 或 triggerX1Payload 尚未初始化，请等待 hook 捕获");
        return "fail";
    }

    var msgAddrInfo = {
        "text":  { messageAddr: textMessageAddr,  sendMessageAddr: sendTextMessageAddr,  cgiAddr: textCgiAddr,  protoHexSetter: function(h) { textProtoHexGlobal = h; } },
        "img":   { messageAddr: imgMessageAddr,   sendMessageAddr: sendImgMessageAddr,   cgiAddr: imgCgiAddr,   protoHexSetter: function(h) { imgProtoHexGlobal = h; } },
    };

    var info = msgAddrInfo[msgType];
    if (!info) {
        console.error("[!] unknown msgType: " + msgType);
        return "fail";
    }

    info.protoHexSetter(protoHex);
    taskIdGlobal = taskId;

    info.messageAddr.add(0x08).writeU32(taskIdGlobal);
    info.sendMessageAddr.add(0x20).writeU32(taskIdGlobal);

    const payloadData = hexToByteArray(payloadHex);
    if (payloadData.length > MAX_SEND_PAYLOAD_BYTES) {
        console.error("[!] " + msgType + ": proto 长度 " + payloadData.length +
            " 超过上限 " + MAX_SEND_PAYLOAD_BYTES + "，已拒绝发送");
        return "fail";
    }

    // triggerX0/triggerX1Payload 是从微信自己某次内部 StartTask 调用里抓来的活对象指针，
    // 不是我们分配的记忆。微信可能已经把这块内存释放或复用了，此时往里写就是
    // use-after-free；proto 比原结构体大时更是直接踩进相邻对象的堆内存 —— 两种崩法
    // 都不会立刻报错，而是几分钟后以随机 EXC_BAD_ACCESS 的形式炸在别处，很难归因。
    // 所以写入前先确认整段仍然是可写的；不合格就把模板作废，等下一次 StartTask 重新抓。
    var needSpan = payloadData.length > 0x198 + 8 ? payloadData.length : 0x198 + 8;
    if (!isWritableBuffer(triggerX1Payload, needSpan) || !isWritableBuffer(triggerX0, 8)) {
        console.error("[!] StartTask 载荷模板已失效（" + triggerX1Payload +
            "），作废并等待下一次捕获；本次 " + msgType + " 发送放弃");
        triggerX1Payload = ptr(0);
        triggerX0 = ptr(0);
        return "fail";
    }

    triggerX1Payload.writeByteArray(payloadData);
    triggerX1Payload.add(0x18).writePointer(info.cgiAddr);
    triggerX1Payload.add(0xb8).writePointer(triggerX1Payload.add(0xc0));
    triggerX1Payload.add(0x190).writePointer(triggerX1Payload.add(0x198));
    sendMsgType = msgType;

    const MMStartTask = new NativeFunction(sendFuncAddr, 'int64', ['pointer', 'pointer']);

    try {
        MMStartTask(triggerX0, triggerX1Payload);
        return "1";
    } catch (e) {
        console.error("[!] Error trigger " + msgType + " MMStartTask: " + e);
        return "fail";
    }
}

function triggerSendImgMessage(taskId, sender, receiver, protoHex, payloadHex) {
    return triggerSendMediaMessage(taskId, sender, receiver, protoHex, payloadHex, "img");
}



function triggerUploadImg(taskId, receiver, md5, imagePath, payloadHex) {
    return fillUploadX1AndStart(taskId, imageIdAddr, ImagePathAddr1, uploadImageX1, receiver, md5, imagePath, payloadHex);
}



function attachUploadMedia() {
    registerHookListener("upload_image_start", Interceptor.attach(uploadImageAddr.add(0x10), {
        onEnter: function (args) {
            if (!enterHook("upload_image_start")) return;
            try {
			uploadGlobalX0 = this.context.x0;
			} finally { leaveHook(); }
		}
    }))
}



function patchCdnOnComplete() {
    registerHookListener("cdn_on_complete", Interceptor.attach(cndOnCompleteAddr, {
        onEnter: function (args) {
            if (!enterHook("cdn_on_complete")) return;
            try {
                const x2 = this.context.x2;
                const currentFileId = readUtf8StringIfReadable(readPointerIfReadable(x2.add(0x20)));
                const imageFileId = imageIdAddr.readUtf8String();
                const fileUploadFileId = uploadFileIdAddr.readUtf8String();
                // 2026-09 清理：原式还比对了 videoFileId / voiceFileId，但那两条发送分支
                // （upload_video_finish / upload_voice_finish）Rust 侧零消费方，已随之删除。
                // image / fileUpload 两个 fileId 由 triggerUploadImg / triggerUploadFile 写入，
                // 是 Rust media_send.rs 仅有的两个真实分派目标。
                const isManagedUpload = currentFileId === imageFileId || currentFileId === fileUploadFileId;

                const cdnKey = readUtf8StringIfReadable(readPointerIfReadable(x2.add(0x60)));
                const aesKey = readUtf8StringIfReadable(readPointerIfReadable(x2.add(0x78)));
                const md5Key = readUtf8StringIfReadable(readPointerIfReadable(x2.add(0x90)));
                const targetId = readUtf8CStringSafe(x2.add(0x40), 256);

                console.log("cndOnComplete x2: " + x2 + " cdnKey: " + cdnKey + " aesKey: " + aesKey + " md5Key: " + md5Key + " targetId: " + targetId);

                // 2026-09 清理：原实现在这里发 manual_media_upload_finish（用户在微信里手动
                // 上传图片/视频时上报），但 Rust 侧对 "manual_media_upload_finish" 的匹配数为 0 ——
                // lib.rs 的 on_frida_message 只分派 upload_image_finish / upload_file_finish。
                // 事件发出去没有任何接收方，连同 guessManualMediaKind / manualMediaUploadSeen
                // 一并删除。videoId 的读取也只服务于这条已删事件。
                if (!isManagedUpload) {
                    return;
                }

                if (cdnKey !== "" && cdnKey != null && aesKey !== "" && aesKey != null) {
                    const uploadTaskId = resolveUploadTaskId(currentFileId);

                    // 判断是语音、视频、文件还是图片
                    // 2026-09 清理：原分支链首是 upload_voice_finish（Rust 侧零消费方，
                    // 且它上报的 voice_duration / silk_data_len 来自两个恒为 0 的全局变量
                    // ——写入方 triggerUploadVoice 早已删除），以及 upload_video_finish
                    // （同样零消费方）。两个分支一并删除后只剩真实的 image / file 两条。
                    if (currentFileId === fileUploadFileId) {
                        // 文件
                        var attachId = "@cdn_" + cdnKey + "_" + aesKey + "_1";
                        send({
                            type: "upload_file_finish",
                            task_id: uploadTaskId,
                            target_id: targetId,
                            cdn_key: cdnKey,
                            aes_key: aesKey,
                            md5_key: md5Key,
                            attach_id: attachId,
                            file_upload_token: "",
                            overwrite_msg_id: ""
                        });
                    } else {
                        // 图片
                        send({
                            type: "upload_image_finish",
                            task_id: uploadTaskId,
                            target_id: targetId,
                            cdn_key: cdnKey,
                            aes_key: aesKey,
                            md5_key: md5Key
                        });
                    }
                } else {
                    console.error("cdnKey or aesKey 为空");
                }
            } catch (e) {
                console.error("[-] CdnOnComplete error: " + e);
            } finally { leaveHook(); }
        }
    }));
}


function attachGetCallbackFromWrapper() {
    registerHookListener("upload_get_callback", Interceptor.attach(uploadGetCallbackWrapperAddr, {
        onEnter: function (args) {
            if (!enterHook("upload_get_callback")) return;
            try {
                const tmpFileId = this.context.x1.readPointer().readUtf8String();
                const imageFileId = imageIdAddr.readUtf8String();
                const videoFileId = videoIdAddr.readUtf8String();
                const voiceFileId = voiceIdAddr.readUtf8String();
                const fileUploadFileId = uploadFileIdAddr.readUtf8String();
                if (tmpFileId !== imageFileId && tmpFileId !== videoFileId && tmpFileId !== voiceFileId && tmpFileId !== fileUploadFileId) {
                    console.log("[+] GetCallbackFromWrapper tmpFileId: " + tmpFileId + " imageFileId: " + imageFileId + " videoFileId:" + videoFileId + " voiceFileId:" + voiceFileId + " fileUploadFileId:" + fileUploadFileId);
                    return
                }

                uploadCallback.add(0x10).writePointer(uploadGetCallbackWrapperFuncAddr);
                this.context.x8 = uploadCallback;
            } catch (e) {
                console.error("[-] GetCallbackFromWrapper error: " + e);
            } finally { leaveHook(); }
        }
    }))

    registerHookListener("upload_on_complete", Interceptor.attach(uploadOnCompleteAddr, {
        onEnter: function (args) {
            if (!enterHook("upload_on_complete")) return;
            try {
                const tmpFileId = this.context.x1.readPointer().readUtf8String();
                const imageFileId = imageIdAddr.readUtf8String();
                const videoFileId = videoIdAddr.readUtf8String();
                const voiceFileId = voiceIdAddr.readUtf8String();
                const fileUploadFileId = uploadFileIdAddr.readUtf8String();
                if (tmpFileId !== imageFileId && tmpFileId !== videoFileId && tmpFileId !== voiceFileId && tmpFileId !== fileUploadFileId) {
                    console.log("[+] OnComplete tmpFileId: " + tmpFileId + " imageFileId: " + imageFileId + " videoFileId:" + videoFileId + " voiceFileId:" + voiceFileId + " fileUploadFileId:" + fileUploadFileId);
                    return
                }

                uploadCallback.add(0x30).writePointer(uploadOnCompleteFuncAddr);
                this.context.x8 = uploadCallback;
            } catch (e) {
                console.error("[-] OnComplete error: " + e);
            } finally { leaveHook(); }
        }
    }))
}


// -------------------------发送回复消息分区-------------------------




rpc.exports = {
    // 卸钩总闸。宿主在 script.unload() 之前必须先调这个。
    // unload 会直接销毁脚本运行时：NativeCallback 的代码页随之 munmap，
    // 而 ObjC method 表里那最多 9 个 IMP 还指着它 —— 不还原就是必崩。
    // exit/_exit 钩子只能覆盖「微信自己退出」，覆盖不了「宿主主动收尾」，
    // 所以这条 RPC 是让还原逻辑在所有路径上都能跑到的唯一入口。
    zmybotRelease: function() {
        if (globalThis.__zmybotReleased) {
            return { released: true, already: true, imp_failed: 0, inflight: globalThis.__zmybotHookDepth };
        }
        globalThis.__zmybotReleased = true;
        // 先立闸再卸钩：__zmybotQuitting 让之后进来的回调直接短路，
        // 排空阶段才不会被新的调用持续加深度。
        globalThis.__zmybotQuitting = true;
        var stats;
        try {
            stats = releaseRegisteredHooks();
        } catch (e) {
            console.error("[!] zmybotRelease 抛异常: " + e);
            return { released: false, error: String(e),
                     imp_failed: globalThis.__zmybotObjcImpls.length,
                     inflight: globalThis.__zmybotHookDepth };
        }
        // inflight 是排空信号：还原 IMP 只挡住「之后的新调用」，
        // 已经站在 trampoline 里的回调仍会在这页代码上跑完，unload 前必须排掉。
        return {
            released: true,
            hooks: stats.hooks_total,
            imp_restored: stats.imp_restored,
            imp_total: stats.imp_total,
            imp_failed: stats.imp_failed,
            imp_failures: stats.imp_failures,
            inflight: globalThis.__zmybotHookDepth
        };
    },
    // 当前在飞（正站在 trampoline 内）的回调数。
    // 还原 IMP 只能保证「之后不再有新调用进来」，已经在跑的回调
    // 仍会在这页代码上执行完。宿主在 unload 前轮询这个值排空，
    // 否则最后那一个回调可能撞上 munmap。
    zmybotInflight: function() {
        return globalThis.__zmybotHookDepth;
    },
    getSelfProfile: function() {
        return cachedSelfProfile || {};
    },
    triggerSendImgMessage: triggerSendImgMessage,
    triggerUploadImg: triggerUploadImg,
    triggerSendTextMessage: triggerSendTextMessage,
    triggerSendFileMessage: triggerSendFileMessage,
    triggerUploadFile: triggerUploadFile,
};

// -------------------------发送图片消息分区-------------------------

// -------------------------接收消息分区-------------------------

function maybeCaptureLoginQr(bytes) {
    if (!bytes || bytes.length < 32 || globalThis.__zmybotQuitting) return;
    var sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    var start = -1;
    var limit = Math.min(bytes.length - 24, 96);
    for (var i = 0; i < limit; i++) {
        var ok = true;
        for (var j = 0; j < sig.length; j++) {
            if (bytes[i + j] !== sig[j]) { ok = false; break; }
        }
        if (ok) { start = i; break; }
    }
    if (start < 0) return;
    var w = (bytes[start + 16] << 24) | (bytes[start + 17] << 16) | (bytes[start + 18] << 8) | bytes[start + 19];
    var h = (bytes[start + 20] << 24) | (bytes[start + 21] << 16) | (bytes[start + 22] << 8) | bytes[start + 23];
    if (w < 120 || w > 320 || h < 120 || h > 320) return;
    var png = [];
    for (var k = start; k < bytes.length && png.length < 65536; k++) png.push(bytes[k]);
    send({ type: "login_qr", width: w, height: h, png: png });
}

function setReceiver() {
    if (!buf2RespAddr || buf2RespAddr.isNull()) {
        console.error("[-] buf2RespAddr missing, skip setReceiver");
        return;
    }
    // buf2resp 可观测计数器。节流到每 200 次上报一次（首次即报），
    // 避免收包高峰期刷爆 socket 通道。
    // seen 必须在 onEnter **第一行**自增，不能放在任何守卫之后。
    // 之前它排在 isReadablePointer / 长度判据之后，于是「钩子压根没被走到」
    // 和「走到了但被前置守卫拦掉」两种情况都显示 seen=0 —— 探针在最需要它的
    // 场景下不产生任何信息。bail_* 就是为拆开这两种情况而存在的。
    globalThis.__zmybotRecvProbe = globalThis.__zmybotRecvProbe || {
        seen: 0, filtered: 0, passed: 0, reported: 0, report: null,
        bail_quitting: 0, bail_ptr: 0, bail_len: 0, bail_read: 0, bail_guard: 0
    };
    var recvProbe = globalThis.__zmybotRecvProbe;
    recvProbe.bailTotal = function () {
        return this.bail_quitting + this.bail_ptr + this.bail_len + this.bail_read + this.bail_guard;
    };
    recvProbe.report = function (force) {
        // 计数保留给调试状态使用，正常运行不写入日志。
        this.reported = this.seen;
    };
    // 同一个 protobuf 可能同时经过旧的 buf2resp 中间点和 autoBufferWrite。
    // 以长度 + 前 32 字节做短时去重，避免切换兼容入口后向宿主重复投递。
    var forwardedReceive = {};
    function forwardReceive(bytes) {
        var hash = 2166136261;
        var limit = Math.min(bytes.length, 32);
        for (var i = 0; i < limit; i++) {
            hash ^= bytes[i];
            hash = Math.imul(hash, 16777619) >>> 0;
        }
        var key = bytes.length + ":" + hash;
        var now = Date.now();
        if (forwardedReceive[key] && now - forwardedReceive[key] < 2000) return false;
        forwardedReceive[key] = now;
        send({ type: "protobuf_msg", data: Array.from(bytes) });
        return true;
    }

    registerHookListener("buf2resp", Interceptor.attach(buf2RespAddr, {
        onEnter: function (args) {
            if (!enterHook("buf2resp")) { recvProbe.bail_guard += 1; return; }
            // 第一件事就是计数：这一步之前的任何 return 都会让 seen 停在 0，
            // 而「没触发」和「触发了」必须靠它区分。
            recvProbe.seen += 1;
            try {
                if (globalThis.__zmybotQuitting) { recvProbe.bail_quitting += 1; return; }
                // 通过 SP+0x140 读取当前 buf2resp 对应的 taskId
                var respTaskId = this.context.sp.add(0x140).readS32();
				    const currentPtr = this.context.x20;
				    const x2 = this.context.x0.toInt32();
                if (!isReadablePointer(currentPtr)) {
                    recvProbe.bail_ptr += 1;
                    if (recvProbe.bailTotal() <= 5 || recvProbe.bail_ptr <= 5) recvProbe.report(true);
                    return;
                }

                // 判断是否是我们发送的消息的 ack
                if (pendingBuf2RespTaskId !== 0 && respTaskId === pendingBuf2RespTaskId) {
                    // 清理 insertMsgAddr
                    if (!pendingInsertMsgAddr.isNull()) {
                        pendingInsertMsgAddr.writeU64(0x0);
                        console.log("[+] buf2resp: 已清理 insertMsgAddr, msgType=" + pendingSendMsgType + " taskId=" + respTaskId);
                        pendingInsertMsgAddr = ptr(0);
                    }

	                if (x2 <= 0 || x2 > MAX_BUF2RESP_BYTES) {
	                    pendingBuf2RespTaskId = 0;
	                    pendingSendMsgType = "";
	                    return;
	                }
	                if (!isReadableBuffer(currentPtr, x2)) {
	                    pendingBuf2RespTaskId = 0;
	                    pendingSendMsgType = "";
	                    return;
	                }

		                // 读取响应数据
					    var respData = readByteArrayIfReadable(currentPtr, x2);
				    if (respData) {
					    var bytes = new Uint8Array(respData);
					    console.log("[+] buf2resp: 收到响应, msgType=" + pendingSendMsgType + " taskId=" + respTaskId + " len=" + x2);
					    send({
						    type: "buf2resp",
						    msg_type: pendingSendMsgType,
						    task_id: respTaskId,
						    data: Array.from(bytes),
					    });
				    }

				    pendingBuf2RespTaskId = 0;
				    pendingSendMsgType = "";
                    return;
                }

		            if (x2 < 4 || x2 > MAX_RECV_PROTOBUF_BYTES) {
		                recvProbe.bail_len += 1;
		                if (recvProbe.bailTotal() <= 5) recvProbe.report(true);
		                return;
		            }
		            const mem = readByteArrayIfReadable(currentPtr, x2);
		            if (!mem) {
		                recvProbe.bail_read += 1;
		                if (recvProbe.bailTotal() <= 5) recvProbe.report(true);
		                return;
		            }
	                const uint8Array = new Uint8Array(mem);
                maybeCaptureLoginQr(uint8Array);
                // JS 层只做宽松候选判断，具体结构交给 Rust parser，避免误判导致漏消息。
                // 首字节判据：非 protobuf 消息头，判为非聊天消息。
                // seen / passed / filtered 的含义见 __zmybotRecvProbe 定义处。
                if (uint8Array[0] !== 0x08) {
                    recvProbe.filtered += 1;
                    recvProbe.report();
                    return;
                }

                recvProbe.passed += 1;
                recvProbe.report();
                forwardReceive(uint8Array);
            } catch (e) {
                console.error("[-] buf2resp receiver error: " + e);
            } finally { leaveHook(); }
        },
    }));

    // 4.1.12.53 的配置 buf2RespAddr 落在函数中部的 `mov w28, #1`，
    // 该分支在部分响应类型上不会执行。真实数据在它前面的
    // `bl autoBufferWriteFunc` 已经准备好：x1=protobuf、x2=长度。旧版本的
    // 返回地址正好是 buf2RespAddr；新版本即使落在同一函数的另一个分支，
    // 也仍会落在附近。按调用者地址窗口筛掉发送侧调用，覆盖函数内所有收包分支。
    if (autoBufferWriteFunc && !autoBufferWriteFunc.isNull()) {
        var receiveCallsiteReturn = buf2RespAddr.add(0);
        registerHookListener("buf2resp_autobuffer", Interceptor.attach(autoBufferWriteFunc, {
            onEnter: function () {
                if (!enterHook("buf2resp_autobuffer")) {
                    recvProbe.bail_guard += 1;
                    return;
                }
                try {
                    if (globalThis.__zmybotQuitting) {
                        recvProbe.bail_quitting += 1;
                        return;
                    }
                    if (!this.returnAddress) return;
                    var callerOffset = this.returnAddress.sub(baseAddr).toUInt32();
                    var receiveOffset = receiveCallsiteReturn.sub(baseAddr).toUInt32();
                    if (callerOffset + 0x1000 < receiveOffset || callerOffset > receiveOffset + 0x1000) return;
                    recvProbe.seen += 1;
                    var dataPtr = this.context.x1;
                    var dataLen = this.context.x2.toInt32();
                    if (dataLen < 4 || dataLen > MAX_RECV_PROTOBUF_BYTES) {
                        recvProbe.bail_len += 1;
                        return;
                    }
                    if (!isReadableBuffer(dataPtr, dataLen)) {
                        recvProbe.bail_ptr += 1;
                        return;
                    }
                    var raw = readByteArrayIfReadable(dataPtr, dataLen);
                    if (!raw) {
                        recvProbe.bail_read += 1;
                        return;
                    }
                    var bytes = new Uint8Array(raw);
                    maybeCaptureLoginQr(bytes);
                    if (bytes[0] !== 0x08) {
                        recvProbe.filtered += 1;
                        return;
                    }
                    recvProbe.passed += 1;
                    forwardReceive(bytes);
                    recvProbe.report(true);
                } catch (e) {
                    console.error("[-] autoBuffer 收包异常: " + e);
                } finally { leaveHook(); }
            }
        }));
    } else {
        console.error("[-] autoBufferWriteFunc 缺失，未安装兼容收包入口");
    }
    console.log("[+] 收消息钩子已就绪");

}


// -------------------------接收消息分区-------------------------
