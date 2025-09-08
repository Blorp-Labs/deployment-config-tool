import dedent from "dedent";
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Input } from './components/ui/input';
import { Checkbox } from "./components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn, copyToClipboard } from "./lib/utils";
import { FaGithub, FaRegClipboard } from "react-icons/fa6";
import Lowlight from 'react-lowlight'
import 'react-lowlight/all'
import 'highlight.js/styles/github-dark.min.css'
import { Button } from "./components/ui/button";
import JSConfetti from 'js-confetti'

const jsConfetti = new JSConfetti()

enum InstanceSelectionMode {
  DEFAULT_FIRST = "default_first",
  DEFAULT_RANDOM = "default_random",
}

enum ConfigType {
  DOCKER_COMMAND = "Docker Command",
  DOCKERFILE = "Dockerfile",
  DOCKER_COMPOSE = "Docker Compose",
  KUBERNETES = "Kubernetes",
}

type Store = {
  configType: ConfigType,
  setConfigType: (type: ConfigType) => void;
  lockToDefaultInstance: boolean
  setLockToDefaultInstance: (val: boolean) => void;
  name: string
  setName: (name: string) => void;
  defaultInstance: string
  setDefaultInstance: (name: string) => void;
  instanceSelectionMode: InstanceSelectionMode,
  setInstanceSelectionMode: (mode: InstanceSelectionMode) => void;
}

function validateValue<T>(value: T, validator: (value: T) => boolean) {
  try {
    return validator(value);
  } catch {
    return false;
  }
}

const useStore = create<Store>()(
  persist(
    (set) => ({
      name: "Blorp",
      setName: (name) => set({ name }),
      defaultInstance: "https://lemmy.world",
      setDefaultInstance: (defaultInstance) => set({ defaultInstance }),
      lockToDefaultInstance: false,
      setLockToDefaultInstance: (lockToDefaultInstance) => set({ lockToDefaultInstance }),
      instanceSelectionMode: InstanceSelectionMode.DEFAULT_FIRST,
      setInstanceSelectionMode: (instanceSelectionMode) => set({ instanceSelectionMode }),
      configType: ConfigType.DOCKER_COMMAND,
      setConfigType: (configType) => set({ configType })
    }),
    {
      name: 'configure-blorp',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

function getDockerCommand({
  REACT_APP_NAME,
  REACT_APP_DEFAULT_INSTANCE,
  REACT_APP_LOCK_TO_DEFAULT_INSTANCE,
  REACT_APP_INSTANCE_SELECTION_MODE,
  hasMultipleInstances,
}: {
  REACT_APP_NAME: string
  REACT_APP_DEFAULT_INSTANCE: string
  REACT_APP_LOCK_TO_DEFAULT_INSTANCE: boolean,
  REACT_APP_INSTANCE_SELECTION_MODE: InstanceSelectionMode
  hasMultipleInstances: boolean
}) {
  const instances = REACT_APP_DEFAULT_INSTANCE.split(",").map(i => i.trim()).join(",")
  return dedent`
    # pull the latest Blorp image
    docker pull christianjuth/blorp:latest

    # run it on port 8080 (host → container), passing any runtime env‑vars you need
    docker run -d \ 
      --name blorp \ 
      -p 8080:80 \ 
      -e REACT_APP_NAME="${REACT_APP_NAME.trim()}" \ 
      -e REACT_APP_DEFAULT_INSTANCE="${instances}" \ 
      -e REACT_APP_LOCK_TO_DEFAULT_INSTANCE="${REACT_APP_LOCK_TO_DEFAULT_INSTANCE ? 1 : 0}" \ 
      ${hasMultipleInstances ? `-e REACT_APP_INSTANCE_SELECTION_MODE="${REACT_APP_INSTANCE_SELECTION_MODE}" \ \n      ` : ""}christianjuth/blorp:latest
  `
}

// Dockerfile
export function getDockerfile({
  REACT_APP_NAME,
  REACT_APP_DEFAULT_INSTANCE,
  REACT_APP_LOCK_TO_DEFAULT_INSTANCE,
  REACT_APP_INSTANCE_SELECTION_MODE,
  hasMultipleInstances,
}: {
  REACT_APP_NAME: string
  REACT_APP_DEFAULT_INSTANCE: string
  REACT_APP_LOCK_TO_DEFAULT_INSTANCE: boolean
  REACT_APP_INSTANCE_SELECTION_MODE: InstanceSelectionMode
  hasMultipleInstances: boolean
}) {
  const instances = REACT_APP_DEFAULT_INSTANCE
    .split(",")
    .map(i => i.trim())
    .join(",")

  const lockVal = REACT_APP_LOCK_TO_DEFAULT_INSTANCE ? 1 : 0

  return dedent`
    FROM christianjuth/blorp:latest

    ENV REACT_APP_NAME="${REACT_APP_NAME.trim()}"
    ENV REACT_APP_DEFAULT_INSTANCE="${instances}"
    ENV REACT_APP_LOCK_TO_DEFAULT_INSTANCE="${lockVal}"
    ${hasMultipleInstances ? `ENV REACT_APP_INSTANCE_SELECTION_MODE="${REACT_APP_INSTANCE_SELECTION_MODE}"` : ""}

    EXPOSE 80
    # Build:  docker build -t blorp-custom .
    # Run:    docker run -d --name blorp -p 8080:80 blorp-custom
  `.trim()
}

// docker-compose.yaml
export function getCompose({
  REACT_APP_NAME,
  REACT_APP_DEFAULT_INSTANCE,
  REACT_APP_LOCK_TO_DEFAULT_INSTANCE,
  REACT_APP_INSTANCE_SELECTION_MODE,
  hasMultipleInstances,
}: {
  REACT_APP_NAME: string
  REACT_APP_DEFAULT_INSTANCE: string
  REACT_APP_LOCK_TO_DEFAULT_INSTANCE: boolean
  REACT_APP_INSTANCE_SELECTION_MODE: InstanceSelectionMode
  hasMultipleInstances: boolean
}) {
  const instances = REACT_APP_DEFAULT_INSTANCE
    .split(",")
    .map(i => i.trim())
    .join(",")

  const lockVal = REACT_APP_LOCK_TO_DEFAULT_INSTANCE ? 1 : 0

  // Note: quotes kept on env values for safety
  const maybeMode = hasMultipleInstances
    ? `\n      REACT_APP_INSTANCE_SELECTION_MODE: "${REACT_APP_INSTANCE_SELECTION_MODE}"`
    : ""

  return dedent`
    version: "3.8"

    services:
      blorp:
        image: christianjuth/blorp:latest
        container_name: blorp
        ports:
          - "8080:80"
        environment:
          REACT_APP_NAME: "${REACT_APP_NAME.trim()}"
          REACT_APP_DEFAULT_INSTANCE: "${instances}"
          REACT_APP_LOCK_TO_DEFAULT_INSTANCE: "${lockVal}"${maybeMode}
  `.trim()
}

// Kubernetes (Deployment + Service)
export function getKube({
  REACT_APP_NAME,
  REACT_APP_DEFAULT_INSTANCE,
  REACT_APP_LOCK_TO_DEFAULT_INSTANCE,
  REACT_APP_INSTANCE_SELECTION_MODE,
  hasMultipleInstances,
}: {
  REACT_APP_NAME: string
  REACT_APP_DEFAULT_INSTANCE: string
  REACT_APP_LOCK_TO_DEFAULT_INSTANCE: boolean
  REACT_APP_INSTANCE_SELECTION_MODE: InstanceSelectionMode
  hasMultipleInstances: boolean
}) {
  const instances = REACT_APP_DEFAULT_INSTANCE
    .split(",")
    .map(i => i.trim())
    .join(",")

  const lockVal = REACT_APP_LOCK_TO_DEFAULT_INSTANCE ? 1 : 0

  const maybeMode = hasMultipleInstances
    ? dedent`
        - name: REACT_APP_INSTANCE_SELECTION_MODE
          value: "${REACT_APP_INSTANCE_SELECTION_MODE}"`
    : ""

  // Uses a NodePort to approximate host:8080 → container:80 mapping (nodePort 30080).
  return dedent`
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: blorp
      labels:
        app: blorp
    spec:
      replicas: 1
      selector:
        matchLabels:
          app: blorp
      template:
        metadata:
          labels:
            app: blorp
        spec:
          containers:
            - name: blorp
              image: christianjuth/blorp:latest
              ports:
                - containerPort: 80
              env:
                - name: REACT_APP_NAME
                  value: "${REACT_APP_NAME.trim()}"
                - name: REACT_APP_DEFAULT_INSTANCE
                  value: "${instances}"
                - name: REACT_APP_LOCK_TO_DEFAULT_INSTANCE
                  value: "${lockVal}"
                ${maybeMode}
    ---
    apiVersion: v1
    kind: Service
    metadata:
      name: blorp
      labels:
        app: blorp
    spec:
      selector:
        app: blorp
      type: NodePort
      ports:
        - name: http
          port: 80
          targetPort: 80
          nodePort: 30080
  `.trim()
}


function App() {
  const name = useStore(s => s.name);
  const setName = useStore(s => s.setName);

  const defaultInstance = useStore(s => s.defaultInstance);
  const setDefaultInstance = useStore(s => s.setDefaultInstance);
  const defaultInstanceValid = validateValue(defaultInstance, (val) => {
    const instances = val.split(",")
    for (const instance of instances) {
      const url = new URL(instance)
      if (url.pathname.length > 1) {
        throw new Error("no pathname allowed")
      }
    }
    return true
  })

  const lockToDefaultInstance = useStore(s => s.lockToDefaultInstance);
  const setLockToDefaultInstance = useStore(s => s.setLockToDefaultInstance);

  const instanceSelectionMode = useStore(s => s.instanceSelectionMode);
  const setInstanceSelectionMode = useStore(s => s.setInstanceSelectionMode);

  const hasMultipleInstances = defaultInstance.split(",").length > 1

  const configType = useStore(s => s.configType);
  const setConfigType = useStore(s => s.setConfigType);

  const config = {
    REACT_APP_NAME: name,
    REACT_APP_DEFAULT_INSTANCE: defaultInstance,
    REACT_APP_LOCK_TO_DEFAULT_INSTANCE: lockToDefaultInstance,
    REACT_APP_INSTANCE_SELECTION_MODE: instanceSelectionMode,
    hasMultipleInstances,
  }

  let code = "";
  let syntax: "dockerfile" | "bash" | "yaml" = "bash";
  switch (configType) {
    case ConfigType.DOCKER_COMMAND:
      code = getDockerCommand(config);
      syntax = "bash"
      break;
    case ConfigType.DOCKERFILE:
      code = getDockerfile(config);
      syntax = "dockerfile"
      break;
    case ConfigType.DOCKER_COMPOSE:
      code = getCompose(config);
      syntax = "yaml"
      break;
    case ConfigType.KUBERNETES:
      code = getKube(config);
      syntax = "yaml"
      break;
  }

  const demoParams = (() => {
    const params = new URLSearchParams()
    params.set("REACT_APP_NAME", name)
    params.set("REACT_APP_DEFAULT_INSTANCE", defaultInstance)
    params.set("REACT_APP_LOCK_TO_DEFAULT_INSTANCE", lockToDefaultInstance ? "1" : "0")
    params.set("REACT_APP_INSTANCE_SELECTION_MODE", instanceSelectionMode)
    return params.toString();
  })()

  console.log(demoParams)

  return (
    <div className="max-w-3xl mx-auto py-16 flex flex-col gap-6 px-4">
      <h1 className="text-5xl font-jersey">
        DEPLOY BLORP
      </h1>

      <h2 className="text-muted-foreground">
        This tool helps generate deployment configs for Blorp
      </h2>

      <div className={cn("flex flex-col gap-3 border p-4 rounded-sm shadow-sm",
        name.trim().length === 0 && "border-destructive border-dashed bg-destructive/5"
      )}>
        <label htmlFor="name" className="font-mono font-bold">
          REACT_APP_NAME
        </label>
        <p className="text-muted-foreground text-sm">
          This name is used accross copy in the app when refering to itself.
        </p>
        <Input id="name" value={name} onChange={e => setName(e.target.value)} className="font-mono" placeholder="Blorp" />
      </div>

      <div className={cn("flex flex-col gap-3 border p-4 rounded-sm shadow-sm",
        !defaultInstanceValid && "border-destructive border-dashed bg-destructive/5"
      )}>
        <label htmlFor="default-instance" className="font-mono font-bold">
          REACT_APP_DEFAULT_INSTANCE
        </label>
        <p className="text-muted-foreground text-sm">
          Default instance can be set to a single instance or an array of instances.
        </p>
        <div className="dark:prose-invert prose prose-sm">
          <b>
            Examples:
          </b>
          <ul>
            <li><code>https://lemmy.world</code></li>
            <li><code>https://lemmy.world,https://piefed.zip,etc</code></li>
          </ul>
        </div>
        <Input id="default-instance" value={defaultInstance} onChange={e => setDefaultInstance(e.target.value)} className="font-mono" placeholder="https://lemmy.world,https://piefed.zip" />
      </div>

      <div className="flex flex-col gap-3 border p-4 rounded-sm shadow-sm">
        <div className="flex items-center gap-3">
          <Checkbox id="lock" checked={lockToDefaultInstance} onCheckedChange={setLockToDefaultInstance} />
          <label htmlFor="lock" className="font-mono font-bold">
            REACT_APP_LOCK_TO_DEFAULT_INSTANCE
          </label>
        </div>
        <p className="text-muted-foreground text-sm">
          Only allow uses to login/signup to the instance(s) specified in <span className="font-mono">REACT_APP_DEFAULT_INSTANCE</span>
        </p>
      </div>

      <div className={cn("flex flex-col gap-3 border p-4 rounded-sm shadow-sm", !hasMultipleInstances && "opacity-50")}>
        <label htmlFor="default-instance" className="font-mono font-bold">
          REACT_APP_INSTANCE_SELECTION_MODE
        </label>
        <p className="text-muted-foreground text-sm">
          Only nessesary if you specifiy multiple default instances.
        </p>
        <Select value={instanceSelectionMode} onValueChange={setInstanceSelectionMode}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={InstanceSelectionMode.DEFAULT_FIRST}>{InstanceSelectionMode.DEFAULT_FIRST}</SelectItem>
            <SelectItem value={InstanceSelectionMode.DEFAULT_RANDOM}>{InstanceSelectionMode.DEFAULT_RANDOM}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col items-start gap-3 border p-4 rounded-sm shadow-sm">
        <h2 className="font-jersey text-3xl">Try it!</h2>
        <span className="text-muted-foreground">For best results, you should paste the below link into a private tab to prevent issues with any previously persisted state.</span>
        <Button variant="outline" onClick={() => {
          copyToClipboard(`https://blorpblorp.xyz?${demoParams}`);
          jsConfetti.addConfetti()
        }}>
          Copy demo link
        </Button>
      </div>

      <div className="flex flex-col gap-3 border p-4 rounded-sm shadow-sm">
        <h2 className="font-jersey text-3xl">Deploy it!</h2>

        <Tabs value={configType} onValueChange={v => setConfigType(v as ConfigType)}>
          <TabsList>
            <TabsTrigger value={ConfigType.DOCKER_COMMAND}>{ConfigType.DOCKER_COMMAND}</TabsTrigger>
            <TabsTrigger value={ConfigType.DOCKERFILE}>{ConfigType.DOCKERFILE}</TabsTrigger>
            <TabsTrigger value={ConfigType.DOCKER_COMPOSE}>{ConfigType.DOCKER_COMPOSE}</TabsTrigger>
            <TabsTrigger value={ConfigType.KUBERNETES}>{ConfigType.KUBERNETES}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative dark">
          <Button variant="secondary" size="sm" className="absolute top-2 right-2" onClick={() => {
            copyToClipboard(code)
            jsConfetti.addConfetti()
          }}><FaRegClipboard aria-label="Copy to clipboard" /> Copy</Button>
          <Lowlight markers={[]} language={syntax} value={code} className="font-mono rounded-sm overflow-hidden text-xs" />
        </div>

      </div>

      <div className="flex justify-center text-muted-foreground gap-2">
        <a
          href="https://github.com/Blorp-Labs"
          target="_blank"
          className="flex items-center gap-1.5 hover:underline"><FaGithub />View on GitHub</a>
        <span>|</span>
        <span>© Blorp Labs 2026</span>
      </div>
    </div>
  )
}

export default App
