"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface CommandHistory {
  id: string
  command: string
  timestamp: Date
}

interface ProtocolData {
  name: string
  protocol: string
  table: string
  state: string
  since: string
  info: string
}

interface CommandStructure {
  prefix: string
  suffix: string
  placeholder: string
  needsInput: boolean
}

function parseProtocols(text: string): ProtocolData[] {
  // Skip header, parse each line
  const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.startsWith("Name"))
  return lines.map((line) => {
    // Split by whitespace, but keep info column joined
    const [name = "", protocol = "", table = "", state = "", since = "", ...info] = line.split(/\s+/)
    return { name, protocol, table, state, since, info: info.join(" ") }
  })
}

export function BGPLookingGlass() {
  const [selectedNode, setSelectedNode] = useState("all")
  const [selectedProtocol, setSelectedProtocol] = useState("ipv6")
  const [selectedCommand, setSelectedCommand] = useState("show protocols")
  const [commandArgument, setCommandArgument] = useState("")
  const [apiResponse, setApiResponse] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [history, setHistory] = useState<CommandHistory[]>([])
  const [protocolData, setProtocolData] = useState<ProtocolData[]>([])

  // Reset input setiap ganti command dan auto-fetch show protocols
  useEffect(() => {
    setCommandArgument("")
    if (selectedCommand === "show protocols") {
      executeCommand()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCommand])

  const getCommandStructure = (command: string): CommandStructure => {
    const structures: Record<string, CommandStructure> = {
      traceroute: { prefix: "traceroute", suffix: "", placeholder: "IPv4 address (e.g. 8.8.8.8)", needsInput: true },
      traceroute6: { prefix: "traceroute", suffix: "", placeholder: "IPv6 address (e.g. 2001:4860:4860::8888)", needsInput: true },
      "show protocols": { prefix: "show protocols", suffix: "", placeholder: "", needsInput: false },
      "show protocols all": { prefix: "show protocols", suffix: "all", placeholder: "protocol name (e.g. bgp1)", needsInput: true },
      "show route for": { prefix: "show route for", suffix: "", placeholder: "Prefix (e.g. 1.1.1.0/24)", needsInput: true },
      "show route for all": { prefix: "show route for", suffix: "all", placeholder: "Prefix (e.g. 1.1.1.0/24)", needsInput: true },
      "show route for bgpmap": {
        prefix: "show route for",
        suffix: "(bgpmap)",
        placeholder: "Prefix (e.g. 1.1.1.0/24)",
        needsInput: true,
      },
      "show route where net": {
        prefix: "show route where net ~ [",
        suffix: "]",
        placeholder: "Prefix (e.g. 1.1.1.0/24)",
        needsInput: true,
      },
      "show route where net all": {
        prefix: "show route where net ~ [",
        suffix: "] all",
        placeholder: "Prefix (e.g. 1.1.1.0/24)",
        needsInput: true,
      },
      "show route where net bgpmap": {
        prefix: "show route where net ~ [",
        suffix: "] (bgpmap)",
        placeholder: "Prefix (e.g. 1.1.1.0/24)",
        needsInput: true,
      },
      "show route": { prefix: "show route", suffix: "", placeholder: "Prefix (e.g. 1.1.1.0/24)", needsInput: true },
      "show route bgpmap": { prefix: "show route", suffix: "(bgpmap)", placeholder: "Prefix (e.g. 1.1.1.0/24)", needsInput: true },
    }
    return structures[command] || { prefix: command, suffix: "", placeholder: "", needsInput: false }
  }

  const executeCommand = async () => {
    setIsLoading(true)
    try {
      const fullCommand = `lg/${selectedProtocol}: ${selectedCommand}${commandArgument ? ` ${commandArgument}` : ""}`

      // Command mapping for Bird2
      let endpoint = "/bird"
      let command = selectedCommand
      if (selectedCommand === "traceroute") {
        endpoint = "/traceroute"
        command = commandArgument
      } else if (selectedCommand === "traceroute6") {
        endpoint = "/traceroute6"
        command = commandArgument
      } else if (selectedCommand === "show route for") {
        command = `show route for ${commandArgument}`
      } else if (selectedCommand === "show route export") {
        command = `show route export ${commandArgument}`
      } else if (selectedCommand === "show route where asn last") {
        command = `show route where bgp_path.last = ${commandArgument}`
      } else if (selectedCommand === "show route where asn last primary") {
        command = `show route where bgp_path.last = ${commandArgument} primary`
      } else if (selectedCommand === "show route protocol primary") {
        command = `show route protocol ${commandArgument} primary`
      } else if (selectedCommand === "show route where large community") {
        command = `show route where \"(${commandArgument}) ~ bgp_large_community\"`
      } else if (selectedCommand === "show route where net") {
        command = `show route where net ~ [${commandArgument}]`
      } else if (selectedCommand === "show route where net all") {
        command = `show route where net ~ [${commandArgument}] all`
      } else if (selectedCommand === "show route where net bgpmap") {
        command = `show route where net ~ [${commandArgument}] (bgpmap)`
      } else if (selectedCommand === "show route bgpmap") {
        command = `show route ${commandArgument} (bgpmap)`
      } else if (selectedCommand === "show protocols all") {
        command = `show protocols all ${commandArgument}`
      } else if (selectedCommand === "show route for all") {
        command = `show route for ${commandArgument} all`
      } else if (selectedCommand === "show route for bgpmap") {
        command = `show route for ${commandArgument} (bgpmap)`
      }

      const response = await fetch("/api/lgproxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, endpoint }),
      })
      const result = await response.json()
      setApiResponse(result.result || "")

      // Parse show protocols output to table
      if (selectedCommand === "show protocols" && result.result) {
        setProtocolData(parseProtocols(result.result))
      }

      // Add to history
      const newHistoryItem: CommandHistory = {
        id: Date.now().toString(),
        command: fullCommand,
        timestamp: new Date(),
      }
      setHistory((prev) => [newHistoryItem, ...prev])
    } catch (error) {
      console.error("Error executing command:", error)
      setApiResponse("Error: Failed to execute command")
      if (selectedCommand === "show protocols") setProtocolData([])
    } finally {
      setIsLoading(false)
    }
  }

  const executeFromHistory = (historyCommand: string) => {
    // Parse the history command to set the appropriate states
    const parts = historyCommand.split(": ")
    if (parts.length >= 2) {
      const protocolPart = parts[0].split("/")[1]
      const commandPart = parts[1]

      if (protocolPart) setSelectedProtocol(protocolPart)

      if (commandPart.startsWith("show protocols")) {
        setSelectedCommand("show protocols")
        const args = commandPart.replace("show protocols", "").trim()
        setCommandArgument(args)
      } else if (commandPart.startsWith("show route")) {
        setSelectedCommand("show route")
        const args = commandPart.replace("show route", "").trim()
        setCommandArgument(args)
      }
    }
  }

  const commandStructure = getCommandStructure(selectedCommand)

  return (
  <div className="min-h-screen bg-white text-black flex flex-col min-h-screen">
      <div className="bg-gray-100 border-b border-gray-300 px-4 py-2">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-2 md:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-6">
            <div className="flex items-center space-x-2">
              <span className="text-gray-600 text-sm">Nodes:</span>
              <Select value={selectedNode} onValueChange={setSelectedNode}>
                <SelectTrigger className="w-full sm:w-30 h-8 bg-white border-gray-300 text-black text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">all</SelectItem>
                  <SelectItem value="lg">BTD Lampung-ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-600 text-sm">Protocols:</span>
              <div className="flex space-x-1">
                <Button
                  variant={selectedProtocol === "ipv4" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3 text-sm"
                  onClick={() => setSelectedProtocol("ipv4")}
                >
                  IPv4
                </Button>
                <Button
                  variant={selectedProtocol === "ipv6" ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3 text-sm"
                  onClick={() => setSelectedProtocol("ipv6")}
                >
                  IPv6
                </Button>
              </div>
              <span className="text-gray-600 text-sm">BIRD2 2.17.1</span>
            </div>
          </div>
          <h1 className="text-lg md:text-xl font-semibold text-center md:text-right">AS205018 Looking Glass</h1>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 p-4">
          <div className="mb-4">
            <h2 className="text-lg font-medium mb-4">
              lg/{selectedProtocol}: {selectedCommand}
            </h2>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                <span className="text-sm font-medium sm:w-20">Command:</span>
                <Select value={selectedCommand} onValueChange={setSelectedCommand}>
                  <SelectTrigger className="w-full sm:w-60 h-8 bg-white border-gray-300 text-black text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="traceroute">traceroute</SelectItem>
                    <SelectItem value="traceroute6">traceroute6</SelectItem>
                    <SelectItem value="show protocols">show protocols</SelectItem>
                    <SelectItem value="show protocols all">show protocols ... all</SelectItem>
                    <SelectItem value="show route for">show route for ...</SelectItem>
                    <SelectItem value="show route for all">show route for ... all</SelectItem>
                    <SelectItem value="show route for bgpmap">show route for ... (bgpmap)</SelectItem>
                    <SelectItem value="show route where net">show route where net ~ [...]</SelectItem>
                    <SelectItem value="show route where net all">show route where net ~ [...] all</SelectItem>
                    <SelectItem value="show route where net bgpmap">show route where net ~ [...] (bgpmap)</SelectItem>
                    <SelectItem value="show route">show route ...</SelectItem>
                    <SelectItem value="show route bgpmap">show route ... (bgpmap)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0">
                  <div className="flex items-center bg-gray-700 text-white rounded overflow-hidden flex-1 max-w-full">
                    <span className="px-3 py-2 text-sm font-mono whitespace-nowrap">{commandStructure.prefix}</span>
                    {commandStructure.needsInput && (
                      <Input
                        value={commandArgument}
                        onChange={(e) => setCommandArgument(e.target.value)}
                        className="border-0 rounded-none bg-white text-black h-8 flex-1 min-w-0"
                        placeholder={commandStructure.placeholder}
                      />
                    )}
                    {commandStructure.suffix && (
                      <span className="px-3 py-2 text-sm font-mono whitespace-nowrap">{commandStructure.suffix}</span>
                    )}
                  </div>
                  <Button
                    onClick={executeCommand}
                    disabled={isLoading}
                    className="h-8 px-4 bg-blue-600 hover:bg-blue-700 w-full sm:w-auto sm:ml-2"
                  >
                    {isLoading ? "Executing..." : "Execute"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {apiResponse && selectedCommand !== "show protocols" && (
            <div className="mb-4">
              <h3 className="text-sm font-medium mb-2">Output:</h3>
              <pre
                className="bg-gray-800 text-green-400 p-3 rounded text-xs sm:text-sm font-mono overflow-auto max-h-96 min-h-[48px] whitespace-pre break-words"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre',
                  overflowX: 'auto',
                  overflowY: 'auto',
                  maxWidth: '100%',
                }}
              >
                {apiResponse.replace(/<br\s*\/?>(\n)?/gi, '\n')}
              </pre>
            </div>
          )}

          {selectedCommand === "show protocols" && (
            <div className="bg-white text-black rounded border border-gray-200 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-blue-600 cursor-pointer hover:underline">Name ▲</TableHead>
                    <TableHead className="text-blue-600 cursor-pointer hover:underline">protocol ▲</TableHead>
                    <TableHead className="text-blue-600 cursor-pointer hover:underline">table ▲</TableHead>
                    <TableHead className="text-blue-600 cursor-pointer hover:underline">state ▲</TableHead>
                    <TableHead className="text-blue-600 cursor-pointer hover:underline">since ▲</TableHead>
                    <TableHead className="text-blue-600 cursor-pointer hover:underline">info ▲</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {protocolData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                        {isLoading ? "Loading..." : "No data"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    protocolData.map((row, index) => (
                      <TableRow key={index} className="hover:bg-gray-50">
                        <TableCell className="text-blue-600 hover:underline cursor-pointer">{row.name}</TableCell>
                        <TableCell>{row.protocol}</TableCell>
                        <TableCell>{row.table}</TableCell>
                        <TableCell>
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">
                            {row.state}
                          </span>
                        </TableCell>
                        <TableCell>{row.since}</TableCell>
                        <TableCell>{row.info}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="p-3 text-sm text-gray-600 border-t">
                {protocolData.length === 0
                  ? isLoading
                    ? "Loading..."
                    : "No data"
                  : `Showing 1 to ${protocolData.length} of ${protocolData.length} entries`}
              </div>
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 bg-blue-50 border-l-0 lg:border-l border-blue-200 p-4">
          <h3 className="text-blue-800 font-semibold mb-4 text-center">REQUEST HISTORY</h3>
          <div className="space-y-1">
            {history.length === 0 ? (
              <div className="text-blue-600 text-sm text-center py-8">
                Command history will appear here after executing commands
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="bg-white hover:bg-blue-100 p-2 rounded cursor-pointer transition-colors border border-blue-200"
                  onClick={() => executeFromHistory(item.command)}
                >
                  <div className="text-blue-800 text-sm break-words">{item.command}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <footer className="w-full text-center text-xs text-gray-500 py-4 border-t bg-white mt-8">
        Bird Looking Glass &mdash; adapted from
        <a href="https://github.com/sileht/bird-lg" target="_blank" rel="noopener" className="underline mx-1">source code</a>
        under GPL 3.0 &mdash; powered by Next.js, Python Flask, and Bird2
      </footer>
    </div>
  )
}
