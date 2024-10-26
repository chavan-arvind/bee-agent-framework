/**
 * Copyright 2024 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SearchOptions, search as rawDDGSearch, SafeSearchType } from "duck-duck-scrape";
import { stripHtml } from "string-strip-html";
import pThrottle, { Options as ThrottleOptions } from "p-throttle";
import {
  SearchToolOptions,
  SearchToolOutput,
  SearchToolResult,
  SearchToolRunOptions,
} from "./base.js";
import { Tool, ToolInput } from "@/tools/base.js";
import { HeaderGenerator } from "header-generator";
import type { NeedleOptions } from "needle";
import { z } from "zod";
import { Cache } from "@/cache/decoratorCache.js";
import { HttpsProxyAgent } from "https-proxy-agent";

export { SafeSearchType as DuckDuckGoSearchToolSearchType };

export interface DuckDuckGoSearchToolOptions extends SearchToolOptions {
  search?: SearchOptions;
  throttle?: ThrottleOptions | false;
  httpClientOptions?: NeedleOptions;
  maxResultsPerPage: number;
  apiKey?: string;
  http_proxy_url?: string;
}

export interface DuckDuckGoSearchToolRunOptions extends SearchToolRunOptions {
  search?: SearchOptions;
  httpClientOptions?: NeedleOptions;
}

export interface DuckDuckGoSearchToolResult extends SearchToolResult {}

export class DuckDuckGoSearchToolOutput extends SearchToolOutput<DuckDuckGoSearchToolResult> {
  constructor(public readonly results: DuckDuckGoSearchToolResult[]) {
    super(results);
  }

  static {
    this.register();
  }

  createSnapshot() {
    return {
      results: this.results,
    };
  }

  loadSnapshot(snapshot: ReturnType<typeof this.createSnapshot>) {
    Object.assign(this, snapshot);
  }
}

export class DuckDuckGoSearchTool extends Tool<
  DuckDuckGoSearchToolOutput,
  DuckDuckGoSearchToolOptions,
  DuckDuckGoSearchToolRunOptions
> {
  name = "DuckDuckGo";
  description =
    "Search for online trends, news, current events, real-time information, or research topics.";

  protected readonly client: typeof rawDDGSearch;

  @Cache()
  inputSchema() {
    return z.object({
      query: z.string({ description: `Search query` }).min(1).max(128),
      page: z.coerce
        .number()
        .int()
        .min(1)
        .max(10)
        .describe(
          `Search result page (each page contains maximally ${this.options.maxResultsPerPage} results)`,
        )
        .default(1)
        .optional(),
    });
  }

  public constructor(options: Partial<DuckDuckGoSearchToolOptions> = {}) {
    super({ ...options, maxResultsPerPage: options?.maxResultsPerPage ?? 15 });

    this.client = this._createClient();
  }

  static {
    this.register();
  }

  protected _createClient() {
    const { throttle } = this.options;

    return throttle === false
      ? rawDDGSearch
      : pThrottle({
          ...throttle,
          limit: throttle?.limit ?? 1,
          interval: throttle?.interval ?? 3000,
        })(rawDDGSearch);
  }

  protected async _run(
    { query: input, page = 1 }: ToolInput<this>,
    options?: DuckDuckGoSearchToolRunOptions,
  ) {
    const headers = new HeaderGenerator().getHeaders();

    if (this.options.apiKey) {
      headers["Authorization"] = `Bearer ${this.options.apiKey}`;
    }

    const httpClientOptions = {
      ...this.options?.httpClientOptions,
      ...options?.httpClientOptions,
    };

    if (this.options.http_proxy_url) {
      httpClientOptions.agent = new HttpsProxyAgent(this.options.http_proxy_url);
    }

    const { results } = await this.client(
      input,
      {
        offset: this.options.maxResultsPerPage * (page - 1),
        safeSearch: SafeSearchType.MODERATE,
        ...this.options.search,
        ...options?.search,
      },
      {
        headers,
        user_agent: headers["user-agent"],
        ...httpClientOptions,
      },
    );

    if (results.length > this.options.maxResultsPerPage) {
      results.length = this.options.maxResultsPerPage;
    }

    return new DuckDuckGoSearchToolOutput(
      results.map((result) => ({
        title: stripHtml(result.title).result,
        description: stripHtml(result.description).result,
        url: result.url,
      })),
    );
  }

  loadSnapshot(snapshot: ReturnType<typeof this.createSnapshot>): void {
    super.loadSnapshot(snapshot);
    Object.assign(this, { client: this._createClient() });
  }
}
