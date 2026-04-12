export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_email: string
          actor_id: string
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: string
          ip_address: string
        }
        Insert: {
          action: string
          actor_email?: string
          actor_id: string
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          id?: string
          ip_address?: string
        }
        Relationships: []
      }
      booking_signatures: {
        Row: {
          booking_data: Json
          created_at: string
          created_by: string
          id: string
          room_id: string | null
          signature_data: string | null
          signed: boolean
          signed_at: string | null
          tenant_name: string
          token: string
        }
        Insert: {
          booking_data?: Json
          created_at?: string
          created_by: string
          id?: string
          room_id?: string | null
          signature_data?: string | null
          signed?: boolean
          signed_at?: string | null
          tenant_name: string
          token?: string
        }
        Update: {
          booking_data?: Json
          created_at?: string
          created_by?: string
          id?: string
          room_id?: string | null
          signature_data?: string | null
          signed?: boolean
          signed_at?: string | null
          tenant_name?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_signatures_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          access_card_count: number
          car_plate: string
          company: string
          contract_months: number
          created_at: string
          doc_offer_letter: Json
          doc_passport: Json
          doc_transfer_slip: Json
          documents: Json
          emergency_1_name: string
          emergency_1_phone: string
          emergency_1_relationship: string
          emergency_2_name: string
          emergency_2_phone: string
          emergency_2_relationship: string
          emergency_contact_2: string
          emergency_name: string
          emergency_phone: string
          emergency_relationship: string
          id: string
          monthly_salary: number
          move_in_cost: Json
          move_in_date: string
          occupation: string
          parking: string
          pax_staying: number
          position: string
          reject_reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          room_id: string | null
          status: string
          submitted_by: string | null
          submitted_by_type: string
          tenant_email: string
          tenant_gender: string
          tenant_ic_passport: string
          tenant_name: string
          tenant_nationality: string
          tenant_phone: string
          tenant_race: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          access_card_count?: number
          car_plate?: string
          company?: string
          contract_months?: number
          created_at?: string
          doc_offer_letter?: Json
          doc_passport?: Json
          doc_transfer_slip?: Json
          documents?: Json
          emergency_1_name?: string
          emergency_1_phone?: string
          emergency_1_relationship?: string
          emergency_2_name?: string
          emergency_2_phone?: string
          emergency_2_relationship?: string
          emergency_contact_2?: string
          emergency_name?: string
          emergency_phone?: string
          emergency_relationship?: string
          id?: string
          monthly_salary?: number
          move_in_cost?: Json
          move_in_date: string
          occupation?: string
          parking?: string
          pax_staying?: number
          position?: string
          reject_reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_id?: string | null
          status?: string
          submitted_by?: string | null
          submitted_by_type?: string
          tenant_email?: string
          tenant_gender?: string
          tenant_ic_passport?: string
          tenant_name: string
          tenant_nationality?: string
          tenant_phone: string
          tenant_race?: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          access_card_count?: number
          car_plate?: string
          company?: string
          contract_months?: number
          created_at?: string
          doc_offer_letter?: Json
          doc_passport?: Json
          doc_transfer_slip?: Json
          documents?: Json
          emergency_1_name?: string
          emergency_1_phone?: string
          emergency_1_relationship?: string
          emergency_2_name?: string
          emergency_2_phone?: string
          emergency_2_relationship?: string
          emergency_contact_2?: string
          emergency_name?: string
          emergency_phone?: string
          emergency_relationship?: string
          id?: string
          monthly_salary?: number
          move_in_cost?: Json
          move_in_date?: string
          occupation?: string
          parking?: string
          pax_staying?: number
          position?: string
          reject_reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          room_id?: string | null
          status?: string
          submitted_by?: string | null
          submitted_by_type?: string
          tenant_email?: string
          tenant_gender?: string
          tenant_ic_passport?: string
          tenant_name?: string
          tenant_nationality?: string
          tenant_phone?: string
          tenant_race?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          account_holder: string
          agent_id: string
          amount: number
          bank_account: string
          bank_name: string
          booking_id: string | null
          created_at: string
          description: string
          id: string
          reject_reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_holder?: string
          agent_id: string
          amount?: number
          bank_account?: string
          bank_name?: string
          booking_id?: string | null
          created_at?: string
          description?: string
          id?: string
          reject_reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_holder?: string
          agent_id?: string
          amount?: number
          bank_account?: string
          bank_name?: string
          booking_id?: string | null
          created_at?: string
          description?: string
          id?: string
          reject_reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      condos: {
        Row: {
          access_items: Json
          address: string
          amenities: string
          arrival_instruction: string
          created_at: string
          deposit_info: string
          description: string
          gps_link: string
          id: string
          location_id: string | null
          name: string
          parking_info: string
          photos: Json
          updated_at: string
          visitor_car_parking: string
          visitor_motorcycle_parking: string
        }
        Insert: {
          access_items?: Json
          address?: string
          amenities?: string
          arrival_instruction?: string
          created_at?: string
          deposit_info?: string
          description?: string
          gps_link?: string
          id?: string
          location_id?: string | null
          name: string
          parking_info?: string
          photos?: Json
          updated_at?: string
          visitor_car_parking?: string
          visitor_motorcycle_parking?: string
        }
        Update: {
          access_items?: Json
          address?: string
          amenities?: string
          arrival_instruction?: string
          created_at?: string
          deposit_info?: string
          description?: string
          gps_link?: string
          id?: string
          location_id?: string | null
          name?: string
          parking_info?: string
          photos?: Json
          updated_at?: string
          visitor_car_parking?: string
          visitor_motorcycle_parking?: string
        }
        Relationships: [
          {
            foreignKeyName: "condos_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          user_id: string | null
        }
        Insert: {
          address?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      rooms: {
        Row: {
          access_info: Json
          available_date: string
          bed_type: string
          building: string
          created_at: string
          housemates: Json
          id: string
          internal_only: boolean
          location: string
          max_pax: number
          move_in_cost: Json
          occupied_pax: number
          pax_staying: number
          photos: Json
          rent: number
          room: string
          room_type: string
          special_type: string
          status: string
          tenant_gender: string
          tenant_race: string
          unit: string
          unit_id: string | null
          unit_max_pax: number
          unit_occupied_pax: number
          unit_type: string
          updated_at: string
          wall_type: string
        }
        Insert: {
          access_info?: Json
          available_date?: string
          bed_type?: string
          building: string
          created_at?: string
          housemates?: Json
          id?: string
          internal_only?: boolean
          location: string
          max_pax?: number
          move_in_cost?: Json
          occupied_pax?: number
          pax_staying?: number
          photos?: Json
          rent?: number
          room: string
          room_type?: string
          special_type?: string
          status?: string
          tenant_gender?: string
          tenant_race?: string
          unit: string
          unit_id?: string | null
          unit_max_pax?: number
          unit_occupied_pax?: number
          unit_type?: string
          updated_at?: string
          wall_type?: string
        }
        Update: {
          access_info?: Json
          available_date?: string
          bed_type?: string
          building?: string
          created_at?: string
          housemates?: Json
          id?: string
          internal_only?: boolean
          location?: string
          max_pax?: number
          move_in_cost?: Json
          occupied_pax?: number
          pax_staying?: number
          photos?: Json
          rent?: number
          room?: string
          room_type?: string
          special_type?: string
          status?: string
          tenant_gender?: string
          tenant_race?: string
          unit?: string
          unit_id?: string | null
          unit_max_pax?: number
          unit_occupied_pax?: number
          unit_type?: string
          updated_at?: string
          wall_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          access_card: string
          access_card_deposit: number
          access_card_source: string
          access_info: Json
          admin_fee: number
          building: string
          common_photos: Json
          created_at: string
          deposit: string
          deposit_multiplier: number
          id: string
          internal_only: boolean
          location: string
          meter_rate: number
          meter_type: string
          parking_card_deposit: number
          parking_lot: string
          parking_type: string
          passcode: string
          unit: string
          unit_max_pax: number
          unit_type: string
          updated_at: string
        }
        Insert: {
          access_card?: string
          access_card_deposit?: number
          access_card_source?: string
          access_info?: Json
          admin_fee?: number
          building: string
          common_photos?: Json
          created_at?: string
          deposit?: string
          deposit_multiplier?: number
          id?: string
          internal_only?: boolean
          location: string
          meter_rate?: number
          meter_type?: string
          parking_card_deposit?: number
          parking_lot?: string
          parking_type?: string
          passcode?: string
          unit: string
          unit_max_pax?: number
          unit_type?: string
          updated_at?: string
        }
        Update: {
          access_card?: string
          access_card_deposit?: number
          access_card_source?: string
          access_info?: Json
          admin_fee?: number
          building?: string
          common_photos?: Json
          created_at?: string
          deposit?: string
          deposit_multiplier?: number
          id?: string
          internal_only?: boolean
          location?: string
          meter_rate?: number
          meter_type?: string
          parking_card_deposit?: number
          parking_lot?: string
          parking_type?: string
          passcode?: string
          unit?: string
          unit_max_pax?: number
          unit_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          commission_config: Json
          commission_type: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          commission_config?: Json
          commission_type?: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          commission_config?: Json
          commission_type?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "agent" | "boss" | "manager"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "agent", "boss", "manager"],
    },
  },
} as const
