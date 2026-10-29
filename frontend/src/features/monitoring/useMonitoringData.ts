import { useCallback, useEffect, useState } from "react";
import { fetchEvents, fetchHealth, fetchMetrics, fetchObservations } from "../../shared/api/client";
import type {
  EndpointErrors,
  MonitoringData,
  MonitoringEndpoint,
} from "../../shared/api/types";
import { demoMonitoringData } from "./demoData";

const EMPTY_DATA: MonitoringData = {
  health: null,
  observations: null,
  events: null,
  metrics: null,
};

type EndpointResult = {
  endpoint: MonitoringEndpoint;
  request: () => Promise<MonitoringData[MonitoringEndpoint]>;
};

export function useMonitoringData(demoMode: boolean) {
  const [data, setData] = useState<MonitoringData>(EMPTY_DATA);
  const [errors, setErrors] = useState<EndpointErrors>({});
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * Refreshes independent endpoints concurrently and preserves successful data per endpoint.
   * A partial API failure therefore reports its error without erasing the last good response.
   */
  const refresh = useCallback(async () => {
    if (demoMode) {
      setData(demoMonitoringData);
      setErrors({});
      setLastUpdated(Date.now());
      return;
    }
    setRefreshing(true);
    const endpoints: EndpointResult[] = [
      { endpoint: "health", request: fetchHealth },
      { endpoint: "observations", request: fetchObservations },
      { endpoint: "events", request: fetchEvents },
      { endpoint: "metrics", request: fetchMetrics },
    ];
    const results = await Promise.allSettled(endpoints.map(({ request }) => request()));
    const nextErrors: EndpointErrors = {};
    results.forEach((result, index) => {
      const { endpoint } = endpoints[index];
      if (result.status === "fulfilled") {
        setData((current) => ({ ...current, [endpoint]: result.value }));
      } else {
        nextErrors[endpoint] = result.reason instanceof Error ? result.reason.message : String(result.reason);
      }
    });
    setErrors(nextErrors);
    if (results.some((result) => result.status === "fulfilled")) setLastUpdated(Date.now());
    setRefreshing(false);
  }, [demoMode]);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => void refresh(), demoMode ? 30_000 : 5_000);
    return () => window.clearInterval(intervalId);
  }, [demoMode, refresh]);

  return { data, errors, lastUpdated, refreshing, refresh };
}
