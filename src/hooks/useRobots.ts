import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Robot {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  url: string | null;
  assistant_id: string | null;
  prompt: string | null;
  model: string;
  is_mandatory: boolean;
  is_active: boolean;
}

interface RobotWithAreas extends Robot {
  areas: { id: string; name: string }[];
}

export function useRobots() {
  const { user } = useAuth();

  // Fetch user's selected areas
  const { data: userAreas } = useQuery({
    queryKey: ["user-areas", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_areas")
        .select("area_id, areas(id, name)")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch robots available to the user
  const { data: robots, isLoading, error } = useQuery({
    queryKey: ["robots", user?.id, userAreas],
    queryFn: async () => {
      // Fetch all active robots with their areas
      const { data: allRobots, error: robotsError } = await supabase
        .from("robots")
        .select(`
          *,
          robot_areas(
            area_id,
            areas(id, name)
          )
        `)
        .eq("is_active", true)
        .order("name");

      if (robotsError) throw robotsError;

      // Get user's area IDs
      const userAreaIds = userAreas?.map((ua: any) => ua.area_id) || [];

      // Filter robots: mandatory OR matching user's areas
      const filteredRobots = (allRobots || []).filter((robot: any) => {
        if (robot.is_mandatory) return true;
        
        const robotAreaIds = robot.robot_areas?.map((ra: any) => ra.area_id) || [];
        return robotAreaIds.some((areaId: string) => userAreaIds.includes(areaId));
      });

      // Transform data
      return filteredRobots.map((robot: any) => ({
        id: robot.id,
        name: robot.name,
        description: robot.description,
        icon: robot.icon,
        url: robot.url,
        assistant_id: robot.assistant_id,
        prompt: robot.prompt,
        model: robot.model || "gpt-4o",
        is_mandatory: robot.is_mandatory,
        is_active: robot.is_active,
        areas: robot.robot_areas?.map((ra: any) => ra.areas).filter(Boolean) || [],
      })) as RobotWithAreas[];
    },
    enabled: !!user?.id,
  });

  // Separate mandatory and area-specific robots
  const mandatoryRobots = robots?.filter(r => r.is_mandatory) || [];
  const areaRobots = robots?.filter(r => !r.is_mandatory) || [];

  return {
    robots,
    mandatoryRobots,
    areaRobots,
    userAreas,
    isLoading,
    error,
  };
}

export function useRobot(robotId: string | undefined) {
  return useQuery({
    queryKey: ["robot", robotId],
    queryFn: async () => {
      if (!robotId) return null;

      const { data, error } = await supabase
        .from("robots")
        .select(`
          *,
          robot_areas(
            area_id,
            areas(id, name)
          )
        `)
        .eq("id", robotId)
        .single();

      if (error) throw error;

      // Fetch default prompt if robot doesn't have one
      let systemPrompt = data.prompt;
      if (!systemPrompt) {
        const { data: config } = await supabase
          .from("ai_config")
          .select("system_prompt")
          .eq("id", "tutor_default_prompt")
          .single();
        
        systemPrompt = config?.system_prompt || "";
      }

      return {
        ...data,
        systemPrompt,
        commandPrompt: data.command_prompt,
        areas: data.robot_areas?.map((ra: any) => ra.areas).filter(Boolean) || [],
      };
    },
    enabled: !!robotId,
  });
}
